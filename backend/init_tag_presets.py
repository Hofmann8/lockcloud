"""
Initialize default tag presets for LockCloud
Run this script to populate default activity types and instructors
"""
from app import create_app, db
from services.tag_preset_service import tag_preset_service
from auth.models import User


def init_tag_presets():
    """Initialize default tag presets"""
    app = create_app()
    
    with app.app_context():
        # Get first admin user or create a system user
        admin = User.query.filter_by(is_admin=True).first()
        
        if not admin:
            print("No admin user found. Creating system admin...")
            admin = User(
                email='system@lockcloud.local',
                name='System',
                is_admin=True,
                is_active=True
            )
            admin.set_password('system_password_change_me')
            db.session.add(admin)
            db.session.commit()
            print(f"✓ Created system admin user (ID: {admin.id})")
        
        print(f"Using admin user: {admin.name} (ID: {admin.id})")
        print("\nInitializing default tag presets...")
        
        # Initialize default presets
        tag_preset_service.initialize_default_presets(admin.id)
        
        print("\n✓ Tag presets initialized successfully!")
        
        # Display initialized presets
        print("\nActivity Types:")
        activity_types = tag_preset_service.get_active_presets('activity_type')
        for preset in activity_types:
            print(f"  - {preset.display_name} ({preset.value})")
        
        print("\nInstructors:")
        instructors = tag_preset_service.get_active_presets('instructor')
        for preset in instructors:
            print(f"  - {preset.display_name} ({preset.value})")


if __name__ == '__main__':
    init_tag_presets()
