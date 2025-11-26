"""
Tag Preset Service for LockCloud
Handles management of predefined tag options for file categorization
"""
from typing import List, Optional
from flask import current_app
from extensions import db
from files.models import TagPreset


class TagPresetService:
    """Service class for managing tag preset operations"""
    
    # Predefined default activity types
    DEFAULT_ACTIVITY_TYPES = [
        {'value': 'regular_training', 'display_name': '例训'},
        {'value': 'internal_training', 'display_name': '内训'},
        {'value': 'master_class', 'display_name': '大师课'},
        {'value': 'special_event', 'display_name': '特殊活动'}
    ]
    
    # Predefined default instructors (including "none" option)
    DEFAULT_INSTRUCTORS = [
        {'value': 'none', 'display_name': '无'}
    ]
    
    @staticmethod
    def initialize_default_presets(admin_user_id: int) -> None:
        """
        Initialize default tag presets if they don't exist
        
        Args:
            admin_user_id: User ID of the admin creating the presets
        """
        # Initialize activity types
        for preset_data in TagPresetService.DEFAULT_ACTIVITY_TYPES:
            existing = TagPreset.query.filter_by(
                category='activity_type',
                value=preset_data['value']
            ).first()
            
            if not existing:
                preset = TagPreset(
                    category='activity_type',
                    value=preset_data['value'],
                    display_name=preset_data['display_name'],
                    created_by=admin_user_id,
                    is_active=True
                )
                db.session.add(preset)
                current_app.logger.info(
                    f'Initialized default activity type: {preset_data["value"]}'
                )
        
        # Initialize instructors
        for preset_data in TagPresetService.DEFAULT_INSTRUCTORS:
            existing = TagPreset.query.filter_by(
                category='instructor',
                value=preset_data['value']
            ).first()
            
            if not existing:
                preset = TagPreset(
                    category='instructor',
                    value=preset_data['value'],
                    display_name=preset_data['display_name'],
                    created_by=admin_user_id,
                    is_active=True
                )
                db.session.add(preset)
                current_app.logger.info(
                    f'Initialized default instructor: {preset_data["value"]}'
                )
        
        db.session.commit()
        current_app.logger.info('Default tag presets initialized successfully')
    
    @staticmethod
    def get_active_presets(category: str) -> List[TagPreset]:
        """
        Get all active tag presets for a specific category
        
        Args:
            category: Category name ('activity_type' or 'instructor')
        
        Returns:
            List of active TagPreset objects
        
        Raises:
            ValueError: If category is None or empty
        """
        if not category:
            raise ValueError('category cannot be None or empty')
        
        presets = TagPreset.query.filter_by(
            category=category,
            is_active=True
        ).order_by(TagPreset.display_name).all()
        
        current_app.logger.debug(
            f'Retrieved {len(presets)} active presets for category: {category}'
        )
        
        return presets
    
    @staticmethod
    def add_preset(
        category: str,
        value: str,
        display_name: str,
        created_by: int
    ) -> TagPreset:
        """
        Add a new tag preset or reactivate an existing deactivated one
        
        Args:
            category: Category name ('activity_type' or 'instructor')
            value: Tag value (unique within category)
            display_name: Human-readable display name
            created_by: User ID of the creator
        
        Returns:
            TagPreset object (newly created or reactivated)
        
        Raises:
            ValueError: If required parameters are missing or preset already exists
        """
        if not category:
            raise ValueError('category cannot be None or empty')
        if not value:
            raise ValueError('value cannot be None or empty')
        if not display_name:
            raise ValueError('display_name cannot be None or empty')
        if not created_by:
            raise ValueError('created_by cannot be None')
        
        # Check if preset already exists
        existing = TagPreset.query.filter_by(
            category=category,
            value=value
        ).first()
        
        if existing:
            if not existing.is_active:
                # Reactivate deactivated preset
                existing.is_active = True
                db.session.commit()
                
                current_app.logger.info(
                    f'Reactivated tag preset: {category}:{value}'
                )
                
                return existing
            else:
                # Preset already exists and is active
                raise ValueError(f'标签已存在: {value}')
        
        # Create new preset
        preset = TagPreset(
            category=category,
            value=value,
            display_name=display_name,
            created_by=created_by
        )
        
        db.session.add(preset)
        db.session.commit()
        
        current_app.logger.info(
            f'Created new tag preset: {category}:{value} (display: {display_name})'
        )
        
        return preset
    
    @staticmethod
    def deactivate_preset(preset_id: int) -> Optional[TagPreset]:
        """
        Deactivate a tag preset (soft delete - does not remove from database)
        
        Args:
            preset_id: ID of the tag preset to deactivate
        
        Returns:
            Deactivated TagPreset object, or None if not found
        
        Raises:
            ValueError: If preset_id is None or invalid
        """
        if not preset_id:
            raise ValueError('preset_id cannot be None')
        
        preset = TagPreset.query.get(preset_id)
        
        if not preset:
            current_app.logger.warning(
                f'Tag preset not found for deactivation: {preset_id}'
            )
            return None
        
        if not preset.is_active:
            current_app.logger.info(
                f'Tag preset already deactivated: {preset_id}'
            )
            return preset
        
        preset.is_active = False
        db.session.commit()
        
        current_app.logger.info(
            f'Deactivated tag preset: {preset.category}:{preset.value} (id: {preset_id})'
        )
        
        return preset


# Global tag preset service instance
tag_preset_service = TagPresetService()
