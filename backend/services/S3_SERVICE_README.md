# S3 Service Documentation

## Overview

The S3 service provides a clean interface for interacting with S3-compatible object storage (AWS S3, Bitiful, etc.). It handles signed URL generation, file operations, and metadata retrieval.

## Configuration

The service reads configuration from Flask app config, which loads from environment variables:

```bash
S3_ENDPOINT=https://s3.bitiful.net
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
S3_BUCKET=funkandlove-cloud
AWS_REGION=us-east-1
```

## Usage

### Import the service

```python
from services import s3_service
```

### Generate presigned upload URL

```python
# Basic usage
url = s3_service.generate_presigned_upload_url(
    key='rehearsals/2025-01-session/photo_01.jpg'
)

# With content type and metadata
url = s3_service.generate_presigned_upload_url(
    key='rehearsals/2025-01-session/photo_01.jpg',
    content_type='image/jpeg',
    metadata={'uploader': 'alex', 'session': '2025-01'},
    expiration=3600  # 1 hour (default)
)
```

### Generate presigned delete URL

```python
url = s3_service.generate_presigned_delete_url(
    key='rehearsals/2025-01-session/photo_01.jpg',
    expiration=3600  # 1 hour (default)
)
```

**Note:** This method does NOT validate user ownership. You must validate ownership before calling this method.

### Delete a file directly

```python
success = s3_service.delete_file(
    key='rehearsals/2025-01-session/photo_01.jpg'
)
```

### List files with prefix

```python
files = s3_service.list_files(
    prefix='rehearsals/2025-01-session/',
    max_keys=1000
)

# Returns list of dicts:
# [
#     {
#         'key': 'rehearsals/2025-01-session/photo_01.jpg',
#         'size': 1024000,
#         'last_modified': datetime(...),
#         'etag': 'abc123...'
#     },
#     ...
# ]
```

### Get file metadata

```python
try:
    metadata = s3_service.get_file_metadata(
        key='rehearsals/2025-01-session/photo_01.jpg'
    )
    # Returns:
    # {
    #     'key': '...',
    #     'size': 1024000,
    #     'last_modified': datetime(...),
    #     'content_type': 'image/jpeg',
    #     'metadata': {...},
    #     'etag': 'abc123...'
    # }
except FileNotFoundError:
    # File doesn't exist
    pass
```

## Error Handling

All methods may raise `ClientError` from boto3 if S3 operations fail. The `get_file_metadata` method specifically raises `FileNotFoundError` if the file doesn't exist.

```python
from botocore.exceptions import ClientError

try:
    url = s3_service.generate_presigned_upload_url(key='...')
except ClientError as e:
    # Handle S3 error
    print(f"S3 error: {e}")
except ValueError as e:
    # Handle configuration error
    print(f"Config error: {e}")
```

## Security Notes

1. **Credentials**: Never expose AWS credentials to the frontend. Always generate signed URLs on the backend.

2. **Expiration**: All signed URLs expire after 1 hour (3600 seconds) by default. This is a security best practice.

3. **Ownership validation**: The `generate_presigned_delete_url` method does NOT validate user ownership. Always validate that the requesting user owns the file before generating a delete URL.

4. **Bucket privacy**: The S3 bucket should be configured as private with public-read only for GetObject operations.

## Requirements Satisfied

- **Requirement 8.1**: S3 credentials are loaded from environment variables only
- **Requirement 8.2**: Credentials are never exposed to the frontend
- **Requirement 8.3**: Signed URLs have 1-hour maximum validity
- **Requirement 3.1**: Supports presigned upload URL generation
- **Requirement 5.2**: Supports presigned delete URL generation
- **Requirement 4.1**: Supports file listing with prefix filtering
- **Requirement 5.3**: Supports direct file deletion
