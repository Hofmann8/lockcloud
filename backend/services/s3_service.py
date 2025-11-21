"""
S3 Service for LockCloud
Handles all S3 operations including signed URL generation and file operations
"""
import os
import boto3
from botocore.exceptions import ClientError
from botocore.client import Config as BotoConfig
from flask import current_app
from typing import Optional, Dict, List


class S3Service:
    """Service class for S3 operations"""
    
    def __init__(self):
        """Initialize S3 client with configuration from environment variables"""
        self._client = None
    
    @property
    def client(self):
        """Lazy initialization of S3 client"""
        if self._client is None:
            self._client = self._create_client()
        return self._client
    
    def _create_client(self):
        """Create and configure boto3 S3 client"""
        # Get configuration from Flask app config
        endpoint_url = current_app.config.get('S3_ENDPOINT')
        access_key_id = current_app.config.get('AWS_ACCESS_KEY_ID')
        secret_access_key = current_app.config.get('AWS_SECRET_ACCESS_KEY')
        region_name = current_app.config.get('AWS_REGION', 'us-east-1')
        
        # Validate required credentials
        if not access_key_id or not secret_access_key:
            raise ValueError('S3 credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY')
        
        # Create boto3 client with custom endpoint for Bitiful/AWS
        client = boto3.client(
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
        
        return client
    
    def get_bucket_name(self) -> str:
        """Get the configured S3 bucket name"""
        bucket = current_app.config.get('S3_BUCKET')
        if not bucket:
            raise ValueError('S3_BUCKET not configured')
        return bucket
    
    def generate_presigned_upload_url(
        self,
        key: str,
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None,
        expiration: int = 3600
    ) -> str:
        """
        Generate a presigned URL for uploading a file to S3
        
        Args:
            key: S3 object key (file path in bucket)
            content_type: MIME type of the file (e.g., 'image/jpeg')
            metadata: Additional metadata to include in the upload
            expiration: URL expiration time in seconds (default: 3600 = 1 hour)
        
        Returns:
            Presigned URL string for PUT operation
        
        Raises:
            ClientError: If URL generation fails
        """
        bucket = self.get_bucket_name()
        
        # Prepare parameters for presigned URL
        params = {
            'Bucket': bucket,
            'Key': key
        }
        
        # Add content type if provided
        if content_type:
            params['ContentType'] = content_type
        
        # Add metadata if provided
        if metadata:
            params['Metadata'] = metadata
        
        try:
            # Generate presigned URL for PUT operation
            url = self.client.generate_presigned_url(
                ClientMethod='put_object',
                Params=params,
                ExpiresIn=expiration,
                HttpMethod='PUT'
            )
            
            current_app.logger.info(f'Generated presigned upload URL for key: {key}')
            return url
            
        except ClientError as e:
            current_app.logger.error(f'Failed to generate presigned upload URL: {str(e)}')
            raise
    
    def generate_presigned_upload_url_with_tags(
        self,
        key: str,
        content_type: str,
        tags: Dict[str, str],
        expiration: int = 3600
    ) -> str:
        """
        Generate a presigned URL for uploading a file to S3 with tags
        
        Args:
            key: S3 object key (file path in bucket)
            content_type: MIME type of the file (e.g., 'image/jpeg')
            tags: Dictionary of tags to apply to the object
            expiration: URL expiration time in seconds (default: 3600 = 1 hour)
        
        Returns:
            Presigned URL string for PUT operation with tagging
        
        Raises:
            ClientError: If URL generation fails
        """
        from urllib.parse import quote
        
        bucket = self.get_bucket_name()
        
        # Convert tags dictionary to S3 tagging format (URL-encoded key=value pairs)
        # Must URL-encode both keys and values to handle special characters and Chinese
        tag_string = '&'.join([f'{quote(str(k), safe="")}={quote(str(v), safe="")}' for k, v in tags.items()])
        
        # Prepare parameters for presigned URL
        params = {
            'Bucket': bucket,
            'Key': key,
            'ContentType': content_type,
            'Tagging': tag_string
        }
        
        try:
            # Generate presigned URL for PUT operation with tagging
            url = self.client.generate_presigned_url(
                ClientMethod='put_object',
                Params=params,
                ExpiresIn=expiration,
                HttpMethod='PUT'
            )
            
            current_app.logger.info(f'Generated presigned upload URL with tags for key: {key}')
            return url
            
        except ClientError as e:
            current_app.logger.error(f'Failed to generate presigned upload URL with tags: {str(e)}')
            raise
    
    def get_object_tags(self, key: str) -> Dict[str, str]:
        """
        Get tags for a specific S3 object
        
        Args:
            key: S3 object key (file path in bucket)
        
        Returns:
            Dictionary of tags (key-value pairs)
        
        Raises:
            ClientError: If object doesn't exist or retrieval fails
        """
        bucket = self.get_bucket_name()
        
        try:
            response = self.client.get_object_tagging(
                Bucket=bucket,
                Key=key
            )
            
            # Convert TagSet list to dictionary format
            tags = {tag['Key']: tag['Value'] for tag in response.get('TagSet', [])}
            
            current_app.logger.info(f'Retrieved {len(tags)} tags for object: {key}')
            return tags
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                current_app.logger.warning(f'Object not found: {key}')
                raise FileNotFoundError(f'对象不存在: {key}')
            else:
                current_app.logger.error(f'Failed to get tags for {key}: {str(e)}')
                raise
    
    def update_object_tags(self, key: str, tags: Dict[str, str]) -> None:
        """
        Update tags for a specific S3 object
        
        Args:
            key: S3 object key (file path in bucket)
            tags: Dictionary of tags to apply (replaces existing tags)
        
        Raises:
            ClientError: If object doesn't exist or update fails
        """
        bucket = self.get_bucket_name()
        
        # Convert tags dictionary to S3 TagSet format
        tag_set = [{'Key': k, 'Value': v} for k, v in tags.items()]
        
        try:
            self.client.put_object_tagging(
                Bucket=bucket,
                Key=key,
                Tagging={'TagSet': tag_set}
            )
            
            current_app.logger.info(f'Updated tags for object: {key}')
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                current_app.logger.warning(f'Object not found: {key}')
                raise FileNotFoundError(f'对象不存在: {key}')
            else:
                current_app.logger.error(f'Failed to update tags for {key}: {str(e)}')
                raise
    
    def generate_presigned_delete_url(
        self,
        key: str,
        expiration: int = 3600
    ) -> str:
        """
        Generate a presigned URL for deleting a file from S3
        
        Note: This method generates the URL but does NOT validate user ownership.
        Ownership validation should be done by the caller before generating the URL.
        
        Args:
            key: S3 object key (file path in bucket)
            expiration: URL expiration time in seconds (default: 3600 = 1 hour)
        
        Returns:
            Presigned URL string for DELETE operation
        
        Raises:
            ClientError: If URL generation fails
        """
        bucket = self.get_bucket_name()
        
        try:
            # Generate presigned URL for DELETE operation
            url = self.client.generate_presigned_url(
                ClientMethod='delete_object',
                Params={
                    'Bucket': bucket,
                    'Key': key
                },
                ExpiresIn=expiration,
                HttpMethod='DELETE'
            )
            
            current_app.logger.info(f'Generated presigned delete URL for key: {key}')
            return url
            
        except ClientError as e:
            current_app.logger.error(f'Failed to generate presigned delete URL: {str(e)}')
            raise
    
    def copy_file(self, source_key: str, destination_key: str) -> bool:
        """
        Copy a file within the same S3 bucket
        
        Args:
            source_key: Source S3 object key
            destination_key: Destination S3 object key
        
        Returns:
            True if copy was successful
        
        Raises:
            ClientError: If copy fails
        """
        bucket = self.get_bucket_name()
        
        try:
            # Copy object within the same bucket
            self.client.copy_object(
                Bucket=bucket,
                CopySource={'Bucket': bucket, 'Key': source_key},
                Key=destination_key
            )
            
            current_app.logger.info(f'Successfully copied file from {source_key} to {destination_key}')
            return True
            
        except ClientError as e:
            current_app.logger.error(f'Failed to copy file from {source_key} to {destination_key}: {str(e)}')
            raise
    
    def delete_file(self, key: str) -> bool:
        """
        Delete a file from S3
        
        Args:
            key: S3 object key (file path in bucket)
        
        Returns:
            True if deletion was successful, False otherwise
        
        Raises:
            ClientError: If deletion fails
        """
        bucket = self.get_bucket_name()
        
        try:
            self.client.delete_object(
                Bucket=bucket,
                Key=key
            )
            
            current_app.logger.info(f'Successfully deleted file: {key}')
            return True
            
        except ClientError as e:
            current_app.logger.error(f'Failed to delete file {key}: {str(e)}')
            raise
    
    def list_files(
        self,
        prefix: str = '',
        max_keys: int = 1000
    ) -> List[Dict]:
        """
        List files in S3 bucket with optional prefix filtering
        
        Args:
            prefix: Filter files by prefix (directory path)
            max_keys: Maximum number of files to return
        
        Returns:
            List of file metadata dictionaries with keys:
                - Key: S3 object key
                - Size: File size in bytes
                - LastModified: Last modification timestamp
                - ETag: Entity tag
        
        Raises:
            ClientError: If listing fails
        """
        bucket = self.get_bucket_name()
        
        try:
            response = self.client.list_objects_v2(
                Bucket=bucket,
                Prefix=prefix,
                MaxKeys=max_keys
            )
            
            # Extract file information
            files = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    files.append({
                        'key': obj['Key'],
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'],
                        'etag': obj['ETag'].strip('"')
                    })
            
            current_app.logger.info(f'Listed {len(files)} files with prefix: {prefix}')
            return files
            
        except ClientError as e:
            current_app.logger.error(f'Failed to list files with prefix {prefix}: {str(e)}')
            raise
    
    def get_file_metadata(self, key: str) -> Dict:
        """
        Get metadata for a specific file in S3
        
        Args:
            key: S3 object key (file path in bucket)
        
        Returns:
            Dictionary with file metadata:
                - Key: S3 object key
                - Size: File size in bytes
                - LastModified: Last modification timestamp
                - ContentType: MIME type
                - Metadata: Custom metadata
                - ETag: Entity tag
        
        Raises:
            ClientError: If file doesn't exist or retrieval fails
        """
        bucket = self.get_bucket_name()
        
        try:
            response = self.client.head_object(
                Bucket=bucket,
                Key=key
            )
            
            metadata = {
                'key': key,
                'size': response['ContentLength'],
                'last_modified': response['LastModified'],
                'content_type': response.get('ContentType', 'application/octet-stream'),
                'metadata': response.get('Metadata', {}),
                'etag': response['ETag'].strip('"')
            }
            
            current_app.logger.info(f'Retrieved metadata for file: {key}')
            return metadata
            
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                current_app.logger.warning(f'File not found: {key}')
                raise FileNotFoundError(f'文件不存在: {key}')
            else:
                current_app.logger.error(f'Failed to get metadata for {key}: {str(e)}')
                raise


# Global S3 service instance
s3_service = S3Service()
