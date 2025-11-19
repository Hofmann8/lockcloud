"""
Sync existing AI usage data to user statistics
This script recalculates and updates user AI statistics based on existing conversation data
Run with: python sync_user_ai_stats.py
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from auth.models import User
from ai.models import AIConversation, AIMessage
from ai.service import AIService

def sync_user_stats():
    """Sync user AI statistics from existing conversation data"""
    app = create_app()
    ai_service = AIService()
    
    with app.app_context():
        print("=" * 60)
        print("🔄 Syncing User AI Statistics")
        print("=" * 60)
        
        users = User.query.all()
        print(f"📊 Found {len(users)} users")
        
        updated_count = 0
        for user in users:
            print(f"\n👤 Processing user: {user.email} (ID: {user.id})")
            
            # Get all conversations for this user
            conversations = AIConversation.query.filter_by(user_id=user.id).all()
            
            if not conversations:
                print(f"   ℹ No conversations found, skipping")
                continue
            
            # Calculate totals
            total_prompt_tokens = 0
            total_completion_tokens = 0
            total_tokens = 0
            total_cost = 0.0
            
            for conv in conversations:
                for msg in conv.messages:
                    if msg.role == 'assistant':
                        prompt_tokens = msg.prompt_tokens or 0
                        completion_tokens = msg.completion_tokens or 0
                        msg_total_tokens = msg.total_tokens or 0
                        
                        total_prompt_tokens += prompt_tokens
                        total_completion_tokens += completion_tokens
                        total_tokens += msg_total_tokens
                        
                        # Calculate cost for this message
                        model_info = ai_service.get_model_info(conv.model)
                        pricing = model_info.get('pricing', {'input': 0, 'output': 0})
                        
                        input_cost = (prompt_tokens / 1000000) * pricing['input']
                        output_cost = (completion_tokens / 1000000) * pricing['output']
                        total_cost += input_cost + output_cost
            
            # Update user statistics
            user.ai_total_prompt_tokens = total_prompt_tokens
            user.ai_total_completion_tokens = total_completion_tokens
            user.ai_total_tokens = total_tokens
            user.ai_total_cost = total_cost
            user.ai_conversation_count = len(conversations)
            
            print(f"   ✓ Updated statistics:")
            print(f"     - Conversations: {len(conversations)}")
            print(f"     - Prompt tokens: {total_prompt_tokens:,}")
            print(f"     - Completion tokens: {total_completion_tokens:,}")
            print(f"     - Total tokens: {total_tokens:,}")
            print(f"     - Total cost: ${total_cost:.6f}")
            
            updated_count += 1
        
        # Commit all changes
        try:
            db.session.commit()
            print("\n" + "=" * 60)
            print(f"✅ Successfully updated {updated_count} users")
            print("=" * 60)
        except Exception as e:
            db.session.rollback()
            print("\n" + "=" * 60)
            print(f"❌ Failed to commit changes: {e}")
            print("=" * 60)
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    sync_user_stats()
