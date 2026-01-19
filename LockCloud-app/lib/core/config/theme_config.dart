import 'package:flutter/material.dart';

/// 主题配置 - 与 Web 前端保持一致的浅色主题
/// 
/// 颜色系统参考 lockcloud-frontend/app/globals.css:
/// - 背景色: #fafafa (off-white)
/// - 主文字: #1a1a1a (primary-black)
/// - 强调色: #ff8c42 (orange), #7bc96f (green), #5fa8d3 (blue), #95a5a6 (gray)
/// - 语义色: success (#7bc96f), error (#e74c3c), warning (#ff8c42), info (#5fa8d3)
class ThemeConfig {
  ThemeConfig._();

  // 主色调 - 与 Web 端一致
  static const Color backgroundColor = Color(0xFFFAFAFA);  // --color-white
  static const Color surfaceColor = Color(0xFFFFFFFF);     // 纯白卡片背景
  static const Color primaryColor = Color(0xFFFF8C42);     // --color-orange (主强调色)
  static const Color primaryBlack = Color(0xFF1A1A1A);     // --color-black
  
  // 强调色
  static const Color accentOrange = Color(0xFFFF8C42);     // --color-orange
  static const Color accentGreen = Color(0xFF7BC96F);      // --color-green
  static const Color accentBlue = Color(0xFF5FA8D3);       // --color-blue
  static const Color accentGray = Color(0xFF95A5A6);       // --color-gray
  
  // 语义色
  static const Color successColor = Color(0xFF7BC96F);     // --color-success
  static const Color errorColor = Color(0xFFE74C3C);       // --color-error
  static const Color warningColor = Color(0xFFFF8C42);     // --color-warning
  static const Color infoColor = Color(0xFF5FA8D3);        // --color-info
  
  // 文字颜色
  static const Color onBackgroundColor = Color(0xFF1A1A1A);  // 主文字
  static const Color onSurfaceVariantColor = Color(0xFF666666);  // 次要文字
  static const Color hintColor = Color(0xFF999999);          // 提示文字
  
  // 边框和分割线
  static const Color dividerColor = Color(0xFFE0E0E0);
  static const Color borderColor = Color(0xFFE5E5E5);
  
  // 表面容器色
  static const Color surfaceContainerColor = Color(0xFFF5F5F5);

  /// 浅色主题 - 与 Web 前端一致
  static ThemeData get lightTheme {
    final colorScheme = ColorScheme.light(
      primary: primaryColor,
      onPrimary: Colors.white,
      primaryContainer: primaryColor.withValues(alpha: 0.1),
      onPrimaryContainer: primaryColor,
      secondary: accentBlue,
      onSecondary: Colors.white,
      secondaryContainer: accentBlue.withValues(alpha: 0.1),
      onSecondaryContainer: accentBlue,
      tertiary: accentGreen,
      onTertiary: Colors.white,
      error: errorColor,
      onError: Colors.white,
      errorContainer: errorColor.withValues(alpha: 0.1),
      onErrorContainer: errorColor,
      surface: surfaceColor,
      onSurface: onBackgroundColor,
      onSurfaceVariant: onSurfaceVariantColor,
      surfaceContainerHighest: surfaceContainerColor,
      outline: borderColor,
      outlineVariant: dividerColor,
      shadow: Colors.black.withValues(alpha: 0.1),
      scrim: Colors.black.withValues(alpha: 0.5),
      inverseSurface: primaryBlack,
      onInverseSurface: backgroundColor,
      inversePrimary: primaryColor,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: backgroundColor,

      appBarTheme: AppBarTheme(
        backgroundColor: backgroundColor,
        foregroundColor: onBackgroundColor,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: const TextStyle(color: onBackgroundColor, fontSize: 18, fontWeight: FontWeight.w600),
        iconTheme: const IconThemeData(color: onBackgroundColor),
      ),
      cardTheme: CardThemeData(
        color: surfaceColor,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(8),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: surfaceColor,
        selectedItemColor: primaryColor,
        unselectedItemColor: onSurfaceVariantColor,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surfaceColor,
        indicatorColor: primaryColor.withValues(alpha: 0.2),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return IconThemeData(color: primaryColor);
          return IconThemeData(color: onSurfaceVariantColor);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return TextStyle(color: primaryColor, fontSize: 12, fontWeight: FontWeight.w500);
          }
          return TextStyle(color: onSurfaceVariantColor, fontSize: 12);
        }),
        elevation: 0,
        height: 64,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primaryColor,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primaryColor,
          side: BorderSide(color: primaryColor),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),

      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(foregroundColor: onBackgroundColor),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        elevation: 4,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceContainerColor,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: primaryColor, width: 2)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: errorColor, width: 1)),
        focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: errorColor, width: 2)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: TextStyle(color: onSurfaceVariantColor),
        labelStyle: TextStyle(color: onSurfaceVariantColor),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surfaceColor,
        elevation: 8,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        titleTextStyle: const TextStyle(color: onBackgroundColor, fontSize: 20, fontWeight: FontWeight.w600),
        contentTextStyle: TextStyle(color: onSurfaceVariantColor, fontSize: 14),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surfaceColor,
        elevation: 8,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
        modalBackgroundColor: surfaceColor,
        modalElevation: 8,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: surfaceContainerColor,
        contentTextStyle: const TextStyle(color: onBackgroundColor, fontSize: 14),
        actionTextColor: primaryColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      dividerTheme: DividerThemeData(color: dividerColor, thickness: 1, space: 1),
      listTileTheme: ListTileThemeData(
        tileColor: Colors.transparent,
        selectedTileColor: primaryColor.withValues(alpha: 0.1),
        iconColor: onSurfaceVariantColor,
        textColor: onBackgroundColor,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),

      chipTheme: ChipThemeData(
        backgroundColor: surfaceContainerColor,
        selectedColor: primaryColor.withValues(alpha: 0.2),
        disabledColor: surfaceContainerColor.withValues(alpha: 0.5),
        labelStyle: TextStyle(color: onBackgroundColor, fontSize: 14),
        secondaryLabelStyle: TextStyle(color: primaryColor, fontSize: 14),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        side: BorderSide.none,
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: primaryColor,
        unselectedLabelColor: onSurfaceVariantColor,
        indicatorColor: primaryColor,
        indicatorSize: TabBarIndicatorSize.label,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: primaryColor,
        linearTrackColor: surfaceContainerColor,
        circularTrackColor: surfaceContainerColor,
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: primaryColor,
        inactiveTrackColor: surfaceContainerColor,
        thumbColor: primaryColor,
        overlayColor: primaryColor.withValues(alpha: 0.2),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return primaryColor;
          return onSurfaceVariantColor;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return primaryColor.withValues(alpha: 0.5);
          return surfaceContainerColor;
        }),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return primaryColor;
          return Colors.transparent;
        }),
        checkColor: WidgetStateProperty.all(Colors.white),
        side: BorderSide(color: onSurfaceVariantColor, width: 2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return primaryColor;
          return onSurfaceVariantColor;
        }),
      ),

      textTheme: const TextTheme(
        displayLarge: TextStyle(fontSize: 57, fontWeight: FontWeight.w400, color: onBackgroundColor),
        displayMedium: TextStyle(fontSize: 45, fontWeight: FontWeight.w400, color: onBackgroundColor),
        displaySmall: TextStyle(fontSize: 36, fontWeight: FontWeight.w400, color: onBackgroundColor),
        headlineLarge: TextStyle(fontSize: 32, fontWeight: FontWeight.w600, color: onBackgroundColor),
        headlineMedium: TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: onBackgroundColor),
        headlineSmall: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: onBackgroundColor),
        titleLarge: TextStyle(fontSize: 22, fontWeight: FontWeight.w600, color: onBackgroundColor),
        titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: onBackgroundColor),
        titleSmall: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: onBackgroundColor),
        bodyLarge: TextStyle(fontSize: 16, fontWeight: FontWeight.w400, color: onBackgroundColor),
        bodyMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w400, color: onBackgroundColor),
        bodySmall: TextStyle(fontSize: 12, fontWeight: FontWeight.w400, color: onSurfaceVariantColor),
        labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: onBackgroundColor),
        labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: onBackgroundColor),
        labelSmall: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: onSurfaceVariantColor),
      ),
    );
  }
}
