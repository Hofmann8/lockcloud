"""
File Naming Service for LockCloud
Handles automatic file naming based on activity date and sequential indexing
"""
import os
from datetime import date
from typing import Optional
from flask import current_app


class FileNamingService:
    """Service class for automatic file naming operations"""
    
    @staticmethod
    def generate_filename(activity_date: date, file_extension: str) -> str:
        """
        Generate a unique filename based on activity date and sequential index
        
        Format: YYYY-MM-DD_XXX.ext
        Example: 2025-03-15_001.jpg
        
        Args:
            activity_date: The date of the activity
            file_extension: File extension including the dot (e.g., '.jpg', '.pdf')
        
        Returns:
            Generated filename string
        
        Raises:
            ValueError: If activity_date is None or file_extension is invalid
        """
        if activity_date is None:
            raise ValueError('activity_date cannot be None')
        
        if not file_extension or not file_extension.startswith('.'):
            raise ValueError('file_extension must start with a dot (e.g., ".jpg")')
        
        # Import here to avoid circular dependency
        from files.models import File
        
        # Format date as YYYY-MM-DD
        date_str = activity_date.strftime('%Y-%m-%d')
        
        # Query count of files with the same activity_date
        count = File.query.filter(
            File.activity_date == activity_date
        ).count()
        
        # Generate index starting from 001
        index = str(count + 1).zfill(3)
        
        # Construct filename
        filename = f"{date_str}_{index}{file_extension}"
        
        current_app.logger.info(
            f'Generated filename: {filename} for activity_date: {date_str}'
        )
        
        return filename
    
    @staticmethod
    def extract_extension(filename: str) -> str:
        """
        Extract file extension from filename
        
        Args:
            filename: Original filename (e.g., 'photo.jpg', 'document.PDF')
        
        Returns:
            Lowercase file extension including the dot (e.g., '.jpg', '.pdf')
            Returns empty string if no extension found
        
        Raises:
            ValueError: If filename is None or empty
        """
        if not filename:
            raise ValueError('filename cannot be None or empty')
        
        # Use os.path.splitext to extract extension
        _, extension = os.path.splitext(filename)
        
        # Convert to lowercase for consistency
        extension = extension.lower()
        
        current_app.logger.debug(
            f'Extracted extension: {extension} from filename: {filename}'
        )
        
        return extension


# Global file naming service instance
file_naming_service = FileNamingService()
