export const zhCN = {
  // Common
  common: {
    loading: "加载中...",
    submit: "提交",
    cancel: "取消",
    confirm: "确认",
    delete: "删除",
    edit: "编辑",
    save: "保存",
    search: "搜索",
    filter: "筛选",
    upload: "上传",
    download: "下载",
    back: "返回",
    next: "下一步",
    previous: "上一步",
    close: "关闭",
    success: "成功",
    error: "错误",
    warning: "警告",
    info: "信息",
  },

  // Authentication
  auth: {
    login: "登录",
    logout: "退出登录",
    register: "注册",
    email: "邮箱",
    password: "密码",
    name: "花名",
    verificationCode: "验证码",
    sendCode: "发送验证码",
    resendCode: "重新发送",
    loginSuccess: "登录成功",
    loginFailed: "登录失败",
    registerSuccess: "注册成功",
    registerFailed: "注册失败",
    logoutSuccess: "退出成功",
    emailPlaceholder: "请输入浙江大学邮箱",
    passwordPlaceholder: "请输入密码",
    namePlaceholder: "请输入花名",
    codePlaceholder: "请输入验证码",
    emailRequired: "请输入邮箱",
    passwordRequired: "请输入密码",
    nameRequired: "请输入花名",
    codeRequired: "请输入验证码",
    emailInvalid: "邮箱格式不正确",
    emailMustBeZJU: "请使用浙江大学邮箱 (@zju.edu.cn)",
    passwordTooShort: "密码至少需要8个字符",
    codeInvalid: "验证码格式不正确",
    codeSent: "验证码已发送",
    codeExpired: "验证码已过期",
    sessionExpired: "登录已过期，请重新登录",
    unauthorized: "无权访问",
  },

  // Files
  files: {
    title: "文件",
    upload: "上传文件",
    uploadSuccess: "上传成功",
    uploadFailed: "上传失败",
    deleteSuccess: "删除成功",
    deleteFailed: "删除失败",
    deleteConfirm: "确认删除此文件？",
    noPermission: "您无权删除此文件",
    fileName: "文件名",
    fileSize: "文件大小",
    uploadDate: "上传日期",
    uploader: "上传者",
    directory: "目录",
    selectDirectory: "选择目录",
    dragDropHint: "拖拽文件到此处或点击选择",
    selectFile: "选择文件",
    uploading: "上传中...",
    deleting: "删除中...",
    fileCount: "个文件",
    noFiles: "暂无文件",
    fileNamingHint: "文件命名格式：YYYY-MM-activity_uploader_index.ext",
    fileNamingExample: "例如: 2025-03-session_alex_01.jpg",
    invalidFileName: "文件名格式不正确",
  },

  // Directories
  directories: {
    rehearsals: "排练",
    events: "活动",
    members: "成员",
    resources: "资源",
    admin: "管理",
  },

  // Filters
  filters: {
    all: "全部",
    dateRange: "日期范围",
    uploader: "上传者",
    directory: "目录",
    startDate: "开始日期",
    endDate: "结束日期",
    apply: "应用",
    reset: "重置",
  },

  // Admin
  admin: {
    logs: "操作日志",
    stats: "使用统计",
    time: "时间",
    user: "用户",
    operation: "操作",
    file: "文件",
    totalStorage: "总存储",
    uploadCount: "上传数量",
    activeUsers: "活跃用户",
  },

  // Footer
  footer: {
    builder: "建设者：Hofmann",
    internalUse: "本服务仅供舞队内部使用",
    serverCost: "服务器成本有限，请合理使用带宽",
    domain: "cloud.funk-and.love",
  },

  // Navigation
  nav: {
    teamName: "Funk & Love",
    files: "文件",
    upload: "上传",
    admin: "管理",
  },

  // Errors
  errors: {
    networkError: "网络连接失败",
    serverError: "服务器错误",
    notFound: "未找到",
    forbidden: "无权访问",
    unknown: "未知错误",
  },

  // Units
  units: {
    bytes: "字节",
    kb: "KB",
    mb: "MB",
    gb: "GB",
    year: "年",
    month: "月",
    day: "日",
    hour: "时",
    minute: "分",
    second: "秒",
  },
};

export type Translations = typeof zhCN;
