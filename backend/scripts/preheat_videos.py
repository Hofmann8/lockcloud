"""
视频转码预热脚本
定期预热一个月内的视频，防止缤纷云回收转码缓存

使用方式：
1. Flask CLI: flask preheat-videos
2. 直接运行: python scripts/preheat_videos.py
3. cron 定时: 0 3 * * * cd /path/to/backend && flask preheat-videos

建议每天凌晨执行一次
"""
import sys
import os
import time

# 添加项目根目录到 path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import click
import requests
from datetime import datetime, timedelta
from flask import current_app
from flask.cli import with_appcontext

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False
    def tqdm(iterable, **kwargs):
        return iterable


def preheat_video(s3_key: str, s3_service, verbose: bool = False) -> dict:
    """
    预热单个视频的 1080p 转码（全量预热所有 .ts 分片）
    返回预热结果
    """
    result = {
        's3_key': s3_key,
        'success': False,
        'message': '',
        'segments_total': 0,
        'segments_ok': 0
    }
    
    try:
        # 1. 请求主播放列表
        hls_key = f"{s3_key}!style:medium/auto_medium.m3u8"
        signed_url = s3_service.generate_signed_url(key=hls_key, expiration=300)
        
        resp = requests.get(signed_url, timeout=30)
        if resp.status_code != 200:
            result['message'] = f'Master playlist failed: {resp.status_code}'
            return result
        
        # 2. 请求 1080p 播放列表，获取分片列表
        quality_key = f"{s3_key}!style:medium/1080p_medium.m3u8"
        quality_url = s3_service.generate_signed_url(key=quality_key, expiration=600)
        quality_resp = requests.get(quality_url, timeout=120)
        
        if quality_resp.status_code != 200:
            result['message'] = f'1080p playlist failed: {quality_resp.status_code}'
            return result
        
        # 3. 解析 m3u8 获取所有 .ts 分片
        m3u8_content = quality_resp.text
        segments = []
        for line in m3u8_content.split('\n'):
            line = line.strip()
            if line and not line.startswith('#'):
                # 这是一个分片引用
                if line.endswith('.ts') or '.ts' in line:
                    segments.append(line)
        
        result['segments_total'] = len(segments)
        
        if not segments:
            result['success'] = True
            result['message'] = 'No segments found (possibly already cached)'
            return result
        
        if verbose:
            print(f'    Found {len(segments)} segments to preheat')
        
        # 4. 逐个预热所有 .ts 分片
        segments_ok = 0
        for i, segment in enumerate(segments):
            try:
                # 构建分片的完整 key
                # 分片路径是相对于 1080p_medium.m3u8 的，需要加上目录前缀
                segment_key = f"{s3_key}!style:medium/{segment}"
                segment_url = s3_service.generate_signed_url(key=segment_key, expiration=600)
                
                # 请求分片（触发转码）- 只需要 HEAD 请求或小范围请求即可
                # 使用 Range 请求只获取前 1 字节，减少带宽消耗
                seg_resp = requests.get(
                    segment_url, 
                    timeout=180,  # 单个分片转码可能需要较长时间
                    headers={'Range': 'bytes=0-0'}
                )
                
                if seg_resp.status_code in (200, 206):
                    segments_ok += 1
                elif verbose:
                    print(f'    Segment {i+1}/{len(segments)} failed: {seg_resp.status_code}')
                    
            except requests.Timeout:
                if verbose:
                    print(f'    Segment {i+1}/{len(segments)} timeout')
            except Exception as e:
                if verbose:
                    print(f'    Segment {i+1}/{len(segments)} error: {str(e)}')
        
        result['segments_ok'] = segments_ok
        
        if segments_ok == len(segments):
            result['success'] = True
            result['message'] = f'All {segments_ok} segments preheated'
        elif segments_ok > 0:
            result['success'] = True  # 部分成功也算成功
            result['message'] = f'{segments_ok}/{len(segments)} segments preheated'
        else:
            result['message'] = f'All {len(segments)} segments failed'
            
    except requests.Timeout:
        result['message'] = 'Timeout'
    except Exception as e:
        result['message'] = str(e)
    
    return result


@click.command('preheat-videos')
@click.option('--days', default=30, help='预热多少天内的视频，默认30天')
@click.option('--delay', default=2.0, help='每个视频之间的间隔秒数，默认2秒')
@click.option('--dry-run', is_flag=True, help='只显示要预热的视频，不实际执行')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
@with_appcontext
def preheat_videos_command(days: int, delay: float, dry_run: bool, verbose: bool):
    """预热近期视频的 HLS 转码缓存"""
    from extensions import db
    from files.models import File
    from services.s3_service import s3_service
    
    click.echo(f'[Preheat] 开始预热 {days} 天内的视频...')
    click.echo(f'[Preheat] 请求间隔: {delay} 秒')
    
    # 查询需要预热的视频
    cutoff_date = datetime.utcnow().date() - timedelta(days=days)
    
    videos = File.query.filter(
        File.content_type.like('video/%'),
        File.activity_date >= cutoff_date
    ).order_by(File.activity_date.desc()).all()
    
    click.echo(f'[Preheat] 找到 {len(videos)} 个视频需要预热')
    
    if len(videos) > 0:
        estimated_time = len(videos) * delay
        click.echo(f'[Preheat] 预计耗时: {estimated_time/60:.1f} 分钟')
    
    if dry_run:
        click.echo('[Preheat] Dry run 模式，不实际执行')
        for video in videos:
            click.echo(f'  - {video.filename} ({video.activity_date})')
        return
    
    # 执行预热
    success_count = 0
    fail_count = 0
    total_segments = 0
    total_segments_ok = 0
    
    # 使用 tqdm 显示进度
    iterator = tqdm(videos, desc='预热进度', unit='个') if HAS_TQDM else videos
    
    for i, video in enumerate(iterator):
        if verbose and not HAS_TQDM:
            click.echo(f'[{i+1}/{len(videos)}] 预热: {video.filename}')
        
        result = preheat_video(video.s3_key, s3_service, verbose=verbose)
        
        total_segments += result.get('segments_total', 0)
        total_segments_ok += result.get('segments_ok', 0)
        
        if result['success']:
            success_count += 1
            if verbose:
                msg = f'  ✓ 成功: {video.filename} - {result["message"]}'
                if HAS_TQDM:
                    tqdm.write(msg)
                else:
                    click.echo(msg)
        else:
            fail_count += 1
            msg = f'  ✗ 失败: {video.filename} - {result["message"]}'
            if HAS_TQDM:
                tqdm.write(msg)
            else:
                click.echo(msg)
        
        # 温和地等待，避免请求过快（视频之间的间隔）
        if i < len(videos) - 1:  # 最后一个不用等
            time.sleep(delay)
    
    click.echo(f'\n[Preheat] 完成!')
    click.echo(f'  视频: 成功 {success_count}, 失败 {fail_count}')
    click.echo(f'  分片: 预热 {total_segments_ok}/{total_segments}')


def register_commands(app):
    """注册 CLI 命令到 Flask app"""
    app.cli.add_command(preheat_videos_command)


if __name__ == '__main__':
    # 直接运行时，创建 Flask app context
    from app import create_app
    app = create_app()
    
    with app.app_context():
        from extensions import db
        from files.models import File
        from services.s3_service import s3_service
        
        # 解析参数
        days = 30
        delay = 2.0
        dry_run = '--dry-run' in sys.argv
        verbose = '-v' in sys.argv or '--verbose' in sys.argv
        
        for arg in sys.argv[1:]:
            if arg.startswith('--days='):
                days = int(arg.split('=')[1])
            elif arg.startswith('--delay='):
                delay = float(arg.split('=')[1])
        
        print(f'[Preheat] 开始预热 {days} 天内的视频（全量 1080p 分片）...')
        print(f'[Preheat] 请求间隔: {delay} 秒')
        
        cutoff_date = datetime.utcnow().date() - timedelta(days=days)
        videos = File.query.filter(
            File.content_type.like('video/%'),
            File.activity_date >= cutoff_date
        ).order_by(File.activity_date.desc()).all()
        
        print(f'[Preheat] 找到 {len(videos)} 个视频需要预热')
        
        if dry_run:
            print('[Preheat] Dry run 模式')
            for video in videos:
                print(f'  - {video.filename} ({video.activity_date})')
        else:
            success_count = 0
            fail_count = 0
            total_segments = 0
            total_segments_ok = 0
            
            iterator = tqdm(videos, desc='预热进度', unit='个') if HAS_TQDM else videos
            
            for i, video in enumerate(iterator):
                if verbose and not HAS_TQDM:
                    print(f'[{i+1}/{len(videos)}] 预热: {video.filename}')
                
                result = preheat_video(video.s3_key, s3_service, verbose=verbose)
                
                total_segments += result.get('segments_total', 0)
                total_segments_ok += result.get('segments_ok', 0)
                
                if result['success']:
                    success_count += 1
                    if verbose:
                        msg = f'  ✓ 成功: {video.filename} - {result["message"]}'
                        if HAS_TQDM:
                            tqdm.write(msg)
                        else:
                            print(msg)
                else:
                    fail_count += 1
                    msg = f'  ✗ 失败: {video.filename} - {result["message"]}'
                    if HAS_TQDM:
                        tqdm.write(msg)
                    else:
                        print(msg)
                
                if i < len(videos) - 1:
                    time.sleep(delay)
            
            print(f'\n[Preheat] 完成!')
            print(f'  视频: 成功 {success_count}, 失败 {fail_count}')
            print(f'  分片: 预热 {total_segments_ok}/{total_segments}')
