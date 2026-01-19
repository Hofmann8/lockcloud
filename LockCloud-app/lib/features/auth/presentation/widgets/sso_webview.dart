import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../core/config/theme_config.dart';

/// SSO 认证 URL
const String _ssoAuthUrl = 'https://auth.funk-and.love';

/// SSO 回调 URL 前缀
const String _ssoCallbackPrefix = 'lockcloud://auth/callback';

/// SSO WebView 组件
///
/// 打开 SSO 认证页面，捕获认证回调并提取 Token。
///
/// 使用方式：
/// ```dart
/// final token = await Navigator.of(context).push<String>(
///   MaterialPageRoute(
///     builder: (context) => const SSOWebView(),
///     fullscreenDialog: true,
///   ),
/// );
/// ```
///
/// **Validates: Requirements 1.2, 1.3**
class SSOWebView extends StatefulWidget {
  const SSOWebView({super.key});

  @override
  State<SSOWebView> createState() => _SSOWebViewState();
}

class _SSOWebViewState extends State<SSOWebView> {
  late final WebViewController _controller;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  /// 初始化 WebView 控制器
  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(ThemeConfig.backgroundColor)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: _onPageStarted,
          onPageFinished: _onPageFinished,
          onNavigationRequest: _onNavigationRequest,
          onWebResourceError: _onWebResourceError,
        ),
      )
      ..loadRequest(Uri.parse(_ssoAuthUrl));
  }

  /// 页面开始加载
  void _onPageStarted(String url) {
    if (mounted) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }
  }

  /// 页面加载完成
  void _onPageFinished(String url) {
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  /// 导航请求处理
  ///
  /// 拦截 SSO 回调 URL，提取 Token 并返回
  NavigationDecision _onNavigationRequest(NavigationRequest request) {
    final url = request.url;

    // 检查是否是 SSO 回调 URL
    if (url.startsWith(_ssoCallbackPrefix)) {
      _handleCallback(url);
      return NavigationDecision.prevent;
    }

    return NavigationDecision.navigate;
  }

  /// 处理 SSO 回调
  ///
  /// 从回调 URL 中提取 Token 并返回给调用者
  void _handleCallback(String url) {
    try {
      final uri = Uri.parse(url);
      final token = uri.queryParameters['token'];

      if (token != null && token.isNotEmpty) {
        // 成功获取 Token，返回给调用者
        Navigator.of(context).pop(token);
      } else {
        // Token 为空，显示错误
        setState(() {
          _errorMessage = '认证失败：未获取到有效的 Token';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = '认证失败：解析回调 URL 出错';
      });
    }
  }

  /// Web 资源加载错误
  void _onWebResourceError(WebResourceError error) {
    if (mounted) {
      setState(() {
        _errorMessage = '加载失败：${error.description}';
        _isLoading = false;
      });
    }
  }

  /// 重新加载页面
  void _reload() {
    setState(() {
      _errorMessage = null;
      _isLoading = true;
    });
    _controller.reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('统一身份认证'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    ThemeConfig.primaryColor,
                  ),
                ),
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _reload,
              tooltip: '刷新',
            ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_errorMessage != null) {
      return _buildErrorView();
    }

    return Stack(
      children: [
        WebViewWidget(controller: _controller),
        if (_isLoading) _buildLoadingOverlay(),
      ],
    );
  }

  /// 构建加载遮罩
  Widget _buildLoadingOverlay() {
    return Container(
      color: ThemeConfig.backgroundColor.withValues(alpha: 0.8),
      child: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(
                ThemeConfig.primaryColor,
              ),
            ),
            SizedBox(height: 16),
            Text(
              '正在加载认证页面...',
              style: TextStyle(
                color: ThemeConfig.onSurfaceVariantColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 构建错误视图
  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: ThemeConfig.errorColor,
            ),
            const SizedBox(height: 16),
            Text(
              '加载失败',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: ThemeConfig.onBackgroundColor,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              _errorMessage ?? '未知错误',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: ThemeConfig.onSurfaceVariantColor,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('取消'),
                ),
                const SizedBox(width: 16),
                ElevatedButton(
                  onPressed: _reload,
                  child: const Text('重试'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
