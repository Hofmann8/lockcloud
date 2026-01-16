"""
删除指定日期的测试文件
用法: python scripts/delete_test_files.py
"""
import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date
from app import create_app
from extensions import db
from files.models import File
from services.s3_service import s3_service

def delete_files_by_date(target_date: date, dry_run: bool = True):
    """
    删除指定活动日期的所有文件
    
    Args:
        target_date: 要删除的活动日期
        dry_run: 如果为 True，只打印要删除的文件，不实际删除
    """
    app = create_app()
    
    with app.app_context():
        # 查找指定日期的文件
        files = File.query.filter(File.activity_date == target_date).all()
        
        print(f"\n找到 {len(files)} 个文件，活动日期为 {target_date}")
        print("-" * 60)
        
        for f in files:
            print(f"ID: {f.id} | {f.filename} | 上传者ID: {f.uploader_id} | S3: {f.s3_key}")
        
        if dry_run:
            print("\n[DRY RUN] 以上文件将被删除。")
            print("确认删除请运行: python scripts/delete_test_files.py --confirm")
            return
        
        # 实际删除
        print("\n开始删除...")
        deleted_count = 0
        failed_count = 0
        
        for f in files:
            try:
                # 删除 S3 文件
                s3_service.delete_file(f.s3_key)
                # 删除数据库记录
                db.session.delete(f)
                deleted_count += 1
                print(f"✓ 已删除: {f.filename}")
            except Exception as e:
                failed_count += 1
                print(f"✗ 删除失败: {f.filename} - {str(e)}")
        
        db.session.commit()
        print(f"\n完成！成功删除 {deleted_count} 个文件，失败 {failed_count} 个")


if __name__ == '__main__':
    # 目标日期：2026年1月7日
    target = date(2026, 1, 7)
    
    # 检查是否有 --confirm 参数
    dry_run = '--confirm' not in sys.argv
    
    delete_files_by_date(target, dry_run=dry_run)
