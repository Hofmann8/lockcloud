"""
S3 Public Service for LockCloud
Handles S3 operations for public resources bucket (avatars, backups, etc.)
"""
import boto3
from botocore.exceptions import ClientError
from botocore.client import Config as BotoConfig
from flask import current_app
from typing import Optional, Dict
import uuid
from datetime import datetime


class S3PublicService:
    """Service class for public S3 bucket operations"""
    
    def __init__(self):
        self._client = None
    
    @property
    def client(self):
        """Lazy initialization of S3 client"""
        if self._client is None:
            self._client = self._create_client()
        return self._client
    
    def _create_client(self):
        """Create and configure boto3 S3 client for public bucket"""
        endpoint_url = current_app.config.get('S3_ENDPOINT')
        access_key_id = current_app.config.get('AWS_ACCESS_KEY_ID')
        secret_access_key = current_app.config.get('AWS_SECRET_ACCESS_KEY')
        region_name = current_app.config.get('AWS_REGION', 'us-east-1')
        
        if not access_key_id or not secret_access_key:
            raise ValueError('S3 credentials not configured')
        
        return boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=region_name,
            config=BotoConfig(
                signature_version='s3v4',
                s3={'addressing_style': 'virtual'}
            )
        )
    
    def get_bucket_name(self) -> str:
        """Get the public S3 bucket name"""
        bucket = current_app.config.get('S3_PUBLIC_BUCKET')
        if not bucket:
            raise ValueError('S3_PUBLIC_BUCKET not configured')
        return bucket
    
    def get_public_url(self, key: str) -> str:
        """
        Get public URL for an object (direct access without signing)
        
        Args:
            key: S3 object key
        
        Returns:
            Public URL string
        """
        endpoint = current_app.config.get('S3_PUBLIC_ENDPOINT', '')
        return f"{endpoint}/{key}"
    
    # ============================================================
    # Avatar Operations
    # ============================================================
    
    def generate_avatar_upload_url(
        self,
        user_id: int,
        content_type: str,
        expiration: int = 600
    ) -> Dict[str, str]:
        """
        Generate presigned URL for avatar upload
        
        Args:
            user_id: User ID
            content_type: MIME type (image/jpeg, image/png, image/webp)
            expiration: URL expiration in seconds (default: 10 minutes)
        
        Returns:
            Dict with upload_url and avatar_key
        """
        # Validate content type
        allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if content_type not in allowed_types:
            raise ValueError(f'不支持的图片格式，允许: {", ".join(allowed_types)}')
        
        # Generate unique filename
        ext = content_type.split('/')[-1]
        if ext == 'jpeg':
            ext = 'jpg'
        
        # Avatar path: avatars/{user_id}/{uuid}.{ext}
        filename = f"{uuid.uuid4().hex}.{ext}"
        key = f"avatars/{user_id}/{filename}"
        
        bucket = self.get_bucket_name()
        
        try:
            url = self.client.generate_presigned_url(
                ClientMethod='put_object',
                Params={
                    'Bucket': bucket,
                    'Key': key,
                    'ContentType': content_type
                },
                ExpiresIn=expiration,
                HttpMethod='PUT'
            )
            
            current_app.logger.info(f'Generated avatar upload URL for user {user_id}')
            
            return {
                'upload_url': url,
                'avatar_key': key
            }
            
        except ClientError as e:
            current_app.logger.error(f'Failed to generate avatar upload URL: {str(e)}')
            raise
    
    def delete_avatar(self, key: str) -> bool:
        """
        Delete an avatar from S3
        
        Args:
            key: Avatar S3 key
        
        Returns:
            True if successful
        """
        if not key or not key.startswith('avatars/'):
            return False
        
        bucket = self.get_bucket_name()
        
        try:
            self.client.delete_object(Bucket=bucket, Key=key)
            current_app.logger.info(f'Deleted avatar: {key}')
            return True
        except ClientError as e:
            current_app.logger.error(f'Failed to delete avatar {key}: {str(e)}')
            return False
    
    def generate_signed_url(self, key: str, expiration: int = 3600, style: Optional[str] = None) -> str:
        """
        生成 S3 预签名 URL（支持缤纷云样式规则）
        
        Args:
            key: S3 object key
            expiration: URL expiration in seconds
            style: 样式规则名称 (e.g., 'avatarmd')
        
        Returns:
            Signed URL string
        """
        bucket = self.get_bucket_name()
        
        # Apply style to key if provided (same as main bucket)
        if style and style != 'original':
            signed_key = f"{key}!style={style}"
        else:
            signed_key = key
        
        try:
            url = self.client.generate_presigned_url(
                ClientMethod='get_object',
                Params={
                    'Bucket': bucket,
                    'Key': signed_key
                },
                ExpiresIn=expiration
            )
            
            # 缤纷云需要 !style= 不被 URL 编码
            url = url.replace('%21style%3D', '!style=')
            
            return url
        except ClientError as e:
            current_app.logger.error(f'Failed to generate signed URL: {str(e)}')
            raise
    
    # ============================================================
    # Backup Operations (for scripts)
    # ============================================================
    
    def upload_backup(self, file_path: str, backup_type: str = 'database') -> str:
        """
        Upload a backup file to S3
        
        Args:
            file_path: Local file path to upload
            backup_type: Type of backup (database, config, etc.)
        
        Returns:
            S3 key of uploaded backup
        """
        import os
        
        bucket = self.get_bucket_name()
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = os.path.basename(file_path)
        
        # Backup path: backups/{type}/{date}/{filename}
        date_folder = datetime.utcnow().strftime('%Y/%m')
        key = f"backups/{backup_type}/{date_folder}/{timestamp}_{filename}"
        
        try:
            self.client.upload_file(file_path, bucket, key)
            current_app.logger.info(f'Uploaded backup to {key}')
            return key
        except ClientError as e:
            current_app.logger.error(f'Failed to upload backup: {str(e)}')
            raise
    
    def list_backups(self, backup_type: str = 'database', limit: int = 50) -> list:
        """
        List backup files
        
        Args:
            backup_type: Type of backup to list
            limit: Maximum number of results
        
        Returns:
            List of backup metadata
        """
        bucket = self.get_bucket_name()
        prefix = f"backups/{backup_type}/"
        
        try:
            response = self.client.list_objects_v2(
                Bucket=bucket,
                Prefix=prefix,
                MaxKeys=limit
            )
            
            backups = []
            if 'Contents' in response:
                for obj in sorted(response['Contents'], key=lambda x: x['LastModified'], reverse=True):
                    backups.append({
                        'key': obj['Key'],
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'].isoformat()
                    })
            
            return backups
            
        except ClientError as e:
            current_app.logger.error(f'Failed to list backups: {str(e)}')
            raise


# Global instance
s3_public_service = S3PublicService()
