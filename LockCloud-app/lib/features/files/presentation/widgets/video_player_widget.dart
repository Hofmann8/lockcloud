import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/config/theme_config.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';

/// HLS 视频质量选项
enum VideoQuality {
  auto('auto', '自动', 'auto_medium.m3u8'),
  p1080('1080p', '1080P', '1080p_medium.m3u8'),
  p720('720p', '720P', '720p_medium.m3u8'),
  p480('480p', '480P', '480p_medium.m3u8');

  final String value;
  final String label;
  final String playlist;

  const VideoQuality(this.value, this.label, this.playlist);
}

/// 播放速度选项
enum PlaybackSpeed {
  x0_5(0.5, '0.5x'),
  x1_0(1.0, '1.0x'),
  x1_5(1.5, '1.5x'),
  x2_0(2.0, '2.0x');

  final double value;
  final String label;

  const PlaybackSpeed(this.value, this.label);
}

/// 视频播放器状态
class VideoPlayerState {
  final bool isInitialized;
  final bool isPlaying;
  final bool isBuffering;
  final bool hasError;
  final Duration position;
  final Duration duration;
  final Duration buffered;
  final double playbackSpeed;
  final VideoQuality quality;
  final bool isMirrored;
  final bool isFullscreen;
  final bool showControls;
  final String? errorMessage;

  const VideoPlayerState({
    this.isInitialized = false,
    this.isPlaying = false,
    this.isBuffering = false,
    this.hasError = false,
    this.position = Duration.zero,
    this.duration = Duration.zero,
    this.buffered = Duration.zero,
    this.playbackSpeed = 1.0,
    this.quality = VideoQuality.p1080,
    this.isMirrored = false,
    this.isFullscreen = false,
    this.showControls = true,
    this.errorMessage,
  });

  VideoPlayerState copyWith({
    bool? isInitialized,
    bool? isPlaying,
    bool? isBuffering,
    bool? hasError,
    Duration? position,
    Duration? duration,
    Duration? buffered,
    double? playbackSpeed,
    VideoQuality? quality,
    bool? isMirrored,
    bool? isFullscreen,
    bool? showControls,
    String? errorMessage,
  }) {
    return VideoPlayerState(
      isInitialized: isInitialized ?? this.isInitialized,
      isPlaying: isPlaying ?? this.isPlaying,
      isBuffering: isBuffering ?? this.isBuffering,
      hasError: hasError ?? this.hasError,
      position: position ?? this.position,
      duration: duration ?? this.duration,
      buffered: buffered ?? this.buffered,
      playbackSpeed: playbackSpeed ?? this.playbackSpeed,
      quality: quality ?? this.quality,
      isMirrored: isMirrored ?? this.isMirrored,
      isFullscreen: isFullscreen ?? this.isFullscreen,
      showControls: showControls ?? this.showControls,
      errorMessage: errorMessage,
    );
  }
}


/// 视频播放器组件
///
/// 使用 video_player 实现 HLS 流媒体播放。
/// 支持：
/// - HLS 自适应码率播放
/// - 播放/暂停、进度拖动、音量调节
/// - 全屏切换
/// - 镜像翻转（舞蹈学习功能）
/// - 双击快进/快退
/// - 长按 2 倍速播放
/// - 倍速和清晰度切换
///
/// **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9**
class VideoPlayerWidget extends ConsumerStatefulWidget {
  /// 文件 ID
  final int fileId;

  /// 文件名（用于显示）
  final String filename;

  /// ThumbHash（用于占位图）
  final String? thumbhash;

  /// 初始是否全屏
  final bool initialFullscreen;

  /// 全屏状态变化回调
  final void Function(bool isFullscreen)? onFullscreenChanged;

  const VideoPlayerWidget({
    super.key,
    required this.fileId,
    required this.filename,
    this.thumbhash,
    this.initialFullscreen = false,
    this.onFullscreenChanged,
  });

  @override
  ConsumerState<VideoPlayerWidget> createState() => _VideoPlayerWidgetState();
}

class _VideoPlayerWidgetState extends ConsumerState<VideoPlayerWidget> {
  VideoPlayerController? _controller;
  VideoPlayerState _state = const VideoPlayerState();
  Timer? _hideControlsTimer;
  Timer? _positionUpdateTimer;
  
  // 长按相关
  bool _isLongPressing = false;
  double _speedBeforeLongPress = 1.0;
  
  // 双击相关
  DateTime? _lastTapTime;
  Offset? _lastTapPosition;
  String? _doubleTapIndicator; // 'left', 'right', or null
  
  // 认证 Token
  String? _authToken;

  @override
  void initState() {
    super.initState();
    _initializePlayer();
    if (widget.initialFullscreen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _enterFullscreen();
      });
    }
  }


  @override
  void dispose() {
    _hideControlsTimer?.cancel();
    _positionUpdateTimer?.cancel();
    _controller?.dispose();
    // 退出全屏时恢复系统 UI
    if (_state.isFullscreen) {
      _exitFullscreen();
    }
    super.dispose();
  }

  /// 初始化播放器
  Future<void> _initializePlayer() async {
    try {
      // 获取认证 Token
      final storage = ref.read(secureStorageProvider);
      _authToken = await storage.getToken();
      
      if (_authToken == null) {
        setState(() {
          _state = _state.copyWith(
            hasError: true,
            errorMessage: '未登录，无法播放视频',
          );
        });
        return;
      }

      // 构建 HLS 代理 URL
      final hlsUrl = _buildHlsProxyUrl(_state.quality);
      
      // 创建控制器
      _controller = VideoPlayerController.networkUrl(
        Uri.parse(hlsUrl),
        httpHeaders: {'Authorization': 'Bearer $_authToken'},
      );

      // 初始化
      await _controller!.initialize();
      
      // 设置监听器
      _controller!.addListener(_onVideoStateChanged);
      
      // 开始位置更新定时器
      _startPositionUpdateTimer();

      setState(() {
        _state = _state.copyWith(
          isInitialized: true,
          duration: _controller!.value.duration,
        );
      });

      // 自动播放
      await _controller!.play();
    } catch (e) {
      setState(() {
        _state = _state.copyWith(
          hasError: true,
          errorMessage: '视频加载失败: ${e.toString()}',
        );
      });
    }
  }


  /// 构建 HLS 代理 URL
  ///
  /// **Validates: Requirements 5.1**
  String _buildHlsProxyUrl(VideoQuality quality) {
    return '${ApiConstants.baseUrl}/api/files/hls-proxy/${widget.fileId}/medium/${quality.playlist}';
  }

  /// 视频状态变化回调
  void _onVideoStateChanged() {
    if (_controller == null) return;
    
    final value = _controller!.value;
    
    setState(() {
      _state = _state.copyWith(
        isPlaying: value.isPlaying,
        isBuffering: value.isBuffering,
        hasError: value.hasError,
        position: value.position,
        duration: value.duration,
        buffered: value.buffered.isNotEmpty 
            ? value.buffered.last.end 
            : Duration.zero,
        errorMessage: value.hasError ? '播放出错' : null,
      );
    });
  }

  /// 开始位置更新定时器
  void _startPositionUpdateTimer() {
    _positionUpdateTimer?.cancel();
    _positionUpdateTimer = Timer.periodic(
      const Duration(milliseconds: 200),
      (_) {
        if (_controller != null && _controller!.value.isInitialized) {
          setState(() {
            _state = _state.copyWith(
              position: _controller!.value.position,
            );
          });
        }
      },
    );
  }

  /// 重置隐藏控制栏定时器
  void _resetHideControlsTimer() {
    _hideControlsTimer?.cancel();
    if (_state.isPlaying && _state.showControls) {
      _hideControlsTimer = Timer(const Duration(seconds: 4), () {
        if (mounted && _state.isPlaying) {
          setState(() {
            _state = _state.copyWith(showControls: false);
          });
        }
      });
    }
  }


  /// 切换播放/暂停
  ///
  /// **Validates: Requirements 5.2**
  Future<void> _togglePlayPause() async {
    if (_controller == null) return;
    
    if (_state.isPlaying) {
      await _controller!.pause();
    } else {
      await _controller!.play();
    }
    _resetHideControlsTimer();
  }

  /// 跳转到指定位置
  ///
  /// **Validates: Requirements 5.2**
  Future<void> _seekTo(Duration position) async {
    if (_controller == null) return;
    
    // 确保位置在有效范围内
    final clampedPosition = Duration(
      milliseconds: position.inMilliseconds.clamp(
        0,
        _state.duration.inMilliseconds,
      ),
    );
    
    await _controller!.seekTo(clampedPosition);
    _resetHideControlsTimer();
  }

  /// 快进/快退指定秒数
  ///
  /// **Validates: Requirements 5.5, 5.6**
  Future<void> _seekBy(int seconds) async {
    final newPosition = _state.position + Duration(seconds: seconds);
    await _seekTo(newPosition);
  }

  /// 设置播放速度
  ///
  /// **Validates: Requirements 5.7, 5.8**
  Future<void> _setPlaybackSpeed(double speed) async {
    if (_controller == null) return;
    
    await _controller!.setPlaybackSpeed(speed);
    setState(() {
      _state = _state.copyWith(playbackSpeed: speed);
    });
    _resetHideControlsTimer();
  }

  /// 切换清晰度
  ///
  /// **Validates: Requirements 5.9**
  Future<void> _changeQuality(VideoQuality quality) async {
    if (quality == _state.quality) return;
    
    // 保存当前位置和播放状态
    final currentPosition = _state.position;
    final wasPlaying = _state.isPlaying;
    
    // 释放旧控制器
    _controller?.removeListener(_onVideoStateChanged);
    await _controller?.dispose();
    
    setState(() {
      _state = _state.copyWith(
        quality: quality,
        isInitialized: false,
        isBuffering: true,
      );
    });
    
    // 创建新控制器
    final hlsUrl = _buildHlsProxyUrl(quality);
    _controller = VideoPlayerController.networkUrl(
      Uri.parse(hlsUrl),
      httpHeaders: {'Authorization': 'Bearer $_authToken'},
    );
    
    try {
      await _controller!.initialize();
      _controller!.addListener(_onVideoStateChanged);
      
      // 恢复位置
      await _controller!.seekTo(currentPosition);
      
      // 恢复播放速度
      await _controller!.setPlaybackSpeed(_state.playbackSpeed);
      
      // 恢复播放状态
      if (wasPlaying) {
        await _controller!.play();
      }
      
      setState(() {
        _state = _state.copyWith(
          isInitialized: true,
          duration: _controller!.value.duration,
        );
      });
    } catch (e) {
      setState(() {
        _state = _state.copyWith(
          hasError: true,
          errorMessage: '切换清晰度失败',
        );
      });
    }
  }


  /// 切换镜像
  ///
  /// **Validates: Requirements 5.4**
  void _toggleMirror() {
    setState(() {
      _state = _state.copyWith(isMirrored: !_state.isMirrored);
    });
    _resetHideControlsTimer();
  }

  /// 进入全屏
  ///
  /// **Validates: Requirements 5.3**
  Future<void> _enterFullscreen() async {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    
    setState(() {
      _state = _state.copyWith(isFullscreen: true);
    });
    
    widget.onFullscreenChanged?.call(true);
  }

  /// 退出全屏
  ///
  /// **Validates: Requirements 5.3**
  Future<void> _exitFullscreen() async {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
    ]);
    
    setState(() {
      _state = _state.copyWith(isFullscreen: false);
    });
    
    widget.onFullscreenChanged?.call(false);
  }

  /// 切换全屏
  void _toggleFullscreen() {
    if (_state.isFullscreen) {
      _exitFullscreen();
    } else {
      _enterFullscreen();
    }
  }

  /// 切换控制栏显示
  void _toggleControls() {
    setState(() {
      _state = _state.copyWith(showControls: !_state.showControls);
    });
    _resetHideControlsTimer();
  }

  /// 开始长按（2 倍速播放）
  ///
  /// **Validates: Requirements 5.7**
  void _startLongPress() {
    if (_controller == null || _isLongPressing) return;
    
    _isLongPressing = true;
    _speedBeforeLongPress = _state.playbackSpeed;
    _controller!.setPlaybackSpeed(2.0);
    
    setState(() {
      _state = _state.copyWith(playbackSpeed: 2.0);
    });
  }

  /// 结束长按
  void _endLongPress() {
    if (!_isLongPressing) return;
    
    _isLongPressing = false;
    _controller?.setPlaybackSpeed(_speedBeforeLongPress);
    
    setState(() {
      _state = _state.copyWith(playbackSpeed: _speedBeforeLongPress);
    });
  }


  /// 处理点击事件
  void _handleTap(TapUpDetails details) {
    final now = DateTime.now();
    final tapPosition = details.localPosition;
    
    // 检测双击
    if (_lastTapTime != null && 
        _lastTapPosition != null &&
        now.difference(_lastTapTime!).inMilliseconds < 300 &&
        (tapPosition - _lastTapPosition!).distance < 50) {
      // 双击
      _handleDoubleTap(tapPosition);
      _lastTapTime = null;
      _lastTapPosition = null;
    } else {
      // 单击
      _lastTapTime = now;
      _lastTapPosition = tapPosition;
      
      // 延迟执行单击操作，等待可能的双击
      Future.delayed(const Duration(milliseconds: 300), () {
        if (_lastTapTime == now) {
          _toggleControls();
        }
      });
    }
  }

  /// 处理双击
  ///
  /// **Validates: Requirements 5.5, 5.6**
  void _handleDoubleTap(Offset position) {
    final width = context.size?.width ?? 0;
    
    if (position.dx < width / 3) {
      // 双击左侧：快退 10 秒
      _seekBy(-10);
      _showDoubleTapIndicator('left');
    } else if (position.dx > width * 2 / 3) {
      // 双击右侧：快进 10 秒
      _seekBy(10);
      _showDoubleTapIndicator('right');
    } else {
      // 双击中间：切换播放/暂停
      _togglePlayPause();
    }
  }

  /// 显示双击指示器
  void _showDoubleTapIndicator(String side) {
    setState(() {
      _doubleTapIndicator = side;
    });
    
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) {
        setState(() {
          _doubleTapIndicator = null;
        });
      }
    });
  }

  /// 重试加载
  void _retry() {
    setState(() {
      _state = const VideoPlayerState();
    });
    _initializePlayer();
  }

  /// 格式化时间
  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }


  @override
  Widget build(BuildContext context) {
    return _state.isFullscreen
        ? _buildFullscreenPlayer()
        : _buildNormalPlayer();
  }

  /// 构建普通模式播放器
  Widget _buildNormalPlayer() {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: _buildPlayerContent(),
    );
  }

  /// 构建全屏模式播放器
  Widget _buildFullscreenPlayer() {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: _buildPlayerContent(),
      ),
    );
  }

  /// 构建播放器内容
  Widget _buildPlayerContent() {
    return Container(
      color: Colors.black,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // 视频层
          _buildVideoLayer(),
          
          // 双击指示器
          if (_doubleTapIndicator != null)
            _buildDoubleTapIndicator(),
          
          // 长按 2 倍速指示器
          if (_isLongPressing)
            _buildLongPressIndicator(),
          
          // 控制层
          if (_state.showControls)
            _buildControlsLayer(),
          
          // 加载指示器
          if (_state.isBuffering && !_state.hasError)
            _buildLoadingIndicator(),
          
          // 错误状态
          if (_state.hasError)
            _buildErrorState(),
        ],
      ),
    );
  }

  /// 构建视频层
  Widget _buildVideoLayer() {
    if (!_state.isInitialized || _controller == null) {
      return _buildPlaceholder();
    }

    Widget videoWidget = Center(
      child: AspectRatio(
        aspectRatio: _controller!.value.aspectRatio,
        child: VideoPlayer(_controller!),
      ),
    );

    // 镜像翻转
    if (_state.isMirrored) {
      videoWidget = Transform(
        alignment: Alignment.center,
        transform: Matrix4.identity()..setEntry(0, 0, -1.0),
        child: videoWidget,
      );
    }

    return GestureDetector(
      onTapUp: _handleTap,
      onLongPressStart: (_) => _startLongPress(),
      onLongPressEnd: (_) => _endLongPress(),
      onLongPressCancel: _endLongPress,
      child: videoWidget,
    );
  }

  /// 构建占位图
  Widget _buildPlaceholder() {
    return Container(
      color: ThemeConfig.backgroundColor,
      child: const Center(
        child: CircularProgressIndicator(
          color: ThemeConfig.primaryColor,
        ),
      ),
    );
  }


  /// 构建双击指示器
  Widget _buildDoubleTapIndicator() {
    final isLeft = _doubleTapIndicator == 'left';
    
    return Positioned(
      left: isLeft ? 40 : null,
      right: isLeft ? null : 40,
      top: 0,
      bottom: 0,
      child: Center(
        child: AnimatedOpacity(
          opacity: _doubleTapIndicator != null ? 1.0 : 0.0,
          duration: const Duration(milliseconds: 200),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.black54,
              borderRadius: BorderRadius.circular(40),
            ),
            child: Icon(
              isLeft ? Icons.replay_10 : Icons.forward_10,
              color: Colors.white,
              size: 32,
            ),
          ),
        ),
      ),
    );
  }

  /// 构建长按 2 倍速指示器
  Widget _buildLongPressIndicator() {
    return Positioned(
      top: 16,
      left: 0,
      right: 0,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black87,
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.fast_forward, color: Colors.white, size: 16),
              SizedBox(width: 4),
              Text(
                '2x 快速播放',
                style: TextStyle(color: Colors.white, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 构建加载指示器
  Widget _buildLoadingIndicator() {
    return const Center(
      child: CircularProgressIndicator(
        color: ThemeConfig.primaryColor,
      ),
    );
  }

  /// 构建错误状态
  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.error_outline,
            size: 48,
            color: Colors.red[400],
          ),
          const SizedBox(height: 16),
          Text(
            _state.errorMessage ?? '播放失败',
            style: TextStyle(
              color: Colors.grey[400],
              fontSize: 14,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _retry,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeConfig.primaryColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('重试'),
          ),
        ],
      ),
    );
  }


  /// 构建控制层
  Widget _buildControlsLayer() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.black54,
            Colors.transparent,
            Colors.transparent,
            Colors.black54,
          ],
          stops: const [0.0, 0.2, 0.8, 1.0],
        ),
      ),
      child: Column(
        children: [
          // 顶部栏
          _buildTopBar(),
          
          // 中间区域
          Expanded(
            child: _buildCenterControls(),
          ),
          
          // 底部栏
          _buildBottomBar(),
        ],
      ),
    );
  }

  /// 构建顶部栏
  Widget _buildTopBar() {
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          children: [
            // 返回按钮（全屏模式）
            if (_state.isFullscreen)
              IconButton(
                onPressed: _exitFullscreen,
                icon: const Icon(Icons.arrow_back, color: Colors.white),
              ),
            
            // 文件名
            if (_state.isFullscreen)
              Expanded(
                child: Text(
                  widget.filename,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            
            const Spacer(),
            
            // 镜像按钮
            _buildMirrorButton(),
          ],
        ),
      ),
    );
  }

  /// 构建镜像按钮
  ///
  /// **Validates: Requirements 5.4**
  Widget _buildMirrorButton() {
    return GestureDetector(
      onTap: _toggleMirror,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: _state.isMirrored 
              ? ThemeConfig.primaryColor 
              : Colors.white24,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          '镜像',
          style: TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: _state.isMirrored ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }


  /// 构建中间控制区域
  Widget _buildCenterControls() {
    return Center(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // 快退按钮
          IconButton(
            onPressed: () => _seekBy(-10),
            icon: const Icon(
              Icons.replay_10,
              color: Colors.white,
              size: 36,
            ),
          ),
          
          const SizedBox(width: 24),
          
          // 播放/暂停按钮
          GestureDetector(
            onTap: _togglePlayPause,
            child: Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(32),
              ),
              child: Icon(
                _state.isPlaying ? Icons.pause : Icons.play_arrow,
                color: Colors.white,
                size: 40,
              ),
            ),
          ),
          
          const SizedBox(width: 24),
          
          // 快进按钮
          IconButton(
            onPressed: () => _seekBy(10),
            icon: const Icon(
              Icons.forward_10,
              color: Colors.white,
              size: 36,
            ),
          ),
        ],
      ),
    );
  }

  /// 构建底部栏
  Widget _buildBottomBar() {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 进度条
            _buildProgressBar(),
            
            const SizedBox(height: 8),
            
            // 控制按钮行
            _buildControlButtonsRow(),
          ],
        ),
      ),
    );
  }

  /// 构建进度条
  ///
  /// **Validates: Requirements 5.2**
  Widget _buildProgressBar() {
    final progress = _state.duration.inMilliseconds > 0
        ? _state.position.inMilliseconds / _state.duration.inMilliseconds
        : 0.0;
    final bufferedProgress = _state.duration.inMilliseconds > 0
        ? _state.buffered.inMilliseconds / _state.duration.inMilliseconds
        : 0.0;

    return GestureDetector(
      onHorizontalDragUpdate: (details) {
        final box = context.findRenderObject() as RenderBox?;
        if (box == null) return;
        
        final width = box.size.width - 32; // 减去 padding
        final position = details.localPosition.dx.clamp(0, width);
        final percent = position / width;
        final newPosition = Duration(
          milliseconds: (percent * _state.duration.inMilliseconds).round(),
        );
        _seekTo(newPosition);
      },
      onTapUp: (details) {
        final box = context.findRenderObject() as RenderBox?;
        if (box == null) return;
        
        final width = box.size.width - 32;
        final position = details.localPosition.dx.clamp(0, width);
        final percent = position / width;
        final newPosition = Duration(
          milliseconds: (percent * _state.duration.inMilliseconds).round(),
        );
        _seekTo(newPosition);
      },
      child: Container(
        height: 24,
        alignment: Alignment.center,
        child: Stack(
          alignment: Alignment.centerLeft,
          children: [
            // 背景
            Container(
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // 缓冲进度
            FractionallySizedBox(
              widthFactor: bufferedProgress.clamp(0.0, 1.0),
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white38,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // 播放进度
            FractionallySizedBox(
              widthFactor: progress.clamp(0.0, 1.0),
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  color: ThemeConfig.primaryColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // 拖动手柄
            Positioned(
              left: (progress.clamp(0.0, 1.0) * (MediaQuery.of(context).size.width - 32)) - 6,
              child: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: ThemeConfig.primaryColor,
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }


  /// 构建控制按钮行
  Widget _buildControlButtonsRow() {
    return Row(
      children: [
        // 播放/暂停按钮
        IconButton(
          onPressed: _togglePlayPause,
          icon: Icon(
            _state.isPlaying ? Icons.pause : Icons.play_arrow,
            color: Colors.white,
            size: 24,
          ),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
        ),
        
        // 时间显示
        Text(
          '${_formatDuration(_state.position)} / ${_formatDuration(_state.duration)}',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
          ),
        ),
        
        const Spacer(),
        
        // 倍速按钮
        _buildSpeedButton(),
        
        const SizedBox(width: 8),
        
        // 清晰度按钮
        _buildQualityButton(),
        
        const SizedBox(width: 8),
        
        // 全屏按钮
        IconButton(
          onPressed: _toggleFullscreen,
          icon: Icon(
            _state.isFullscreen ? Icons.fullscreen_exit : Icons.fullscreen,
            color: Colors.white,
            size: 24,
          ),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
        ),
      ],
    );
  }

  /// 构建倍速按钮
  ///
  /// **Validates: Requirements 5.8**
  Widget _buildSpeedButton() {
    return PopupMenuButton<PlaybackSpeed>(
      onSelected: (speed) => _setPlaybackSpeed(speed.value),
      itemBuilder: (context) => PlaybackSpeed.values.map((speed) {
        return PopupMenuItem(
          value: speed,
          child: Row(
            children: [
              if (_state.playbackSpeed == speed.value)
                const Icon(Icons.check, size: 16, color: ThemeConfig.primaryColor)
              else
                const SizedBox(width: 16),
              const SizedBox(width: 8),
              Text(speed.label),
            ],
          ),
        );
      }).toList(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white24,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          '${_state.playbackSpeed}x',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
          ),
        ),
      ),
    );
  }

  /// 构建清晰度按钮
  ///
  /// **Validates: Requirements 5.9**
  Widget _buildQualityButton() {
    return PopupMenuButton<VideoQuality>(
      onSelected: _changeQuality,
      itemBuilder: (context) => VideoQuality.values.map((quality) {
        return PopupMenuItem(
          value: quality,
          child: Row(
            children: [
              if (_state.quality == quality)
                const Icon(Icons.check, size: 16, color: ThemeConfig.primaryColor)
              else
                const SizedBox(width: 16),
              const SizedBox(width: 8),
              Text(quality.label),
            ],
          ),
        );
      }).toList(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white24,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          _state.quality.label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
          ),
        ),
      ),
    );
  }
}
