/**
 * Chinese (Simplified) Localization File
 * 
 * Contains all UI text and error messages for the LockCloud Mobile App.
 * Based on the Web frontend localization (lockcloud-frontend/locales/zh-CN.ts).
 * 
 * Requirements: 12.2 - Use Chinese (zh-CN) as the primary language
 */

export const zhCN = {
  // Common
  common: {
    loading: '加载中...',
    submit: '提交',
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    edit: '编辑',
    save: '保存',
    search: '搜索',
    filter: '筛选',
    upload: '上传',
    download: '下载',
    back: '返回',
    next: '下一步',
    previous: '上一步',
    close: '关闭',
    success: '成功',
    error: '错误',
    warning: '警告',
    info: '信息',
    retry: '重试',
    done: '完成',
    add: '添加',
    remove: '移除',
    clear: '清除',
    selectAll: '全选',
    deselectAll: '取消全选',
    selected: '已选择',
    items: '项',
    noData: '暂无数据',
    refresh: '刷新',
    more: '更多',
    less: '收起',
    yes: '是',
    no: '否',
    ok: '确定',
  },

  // Authentication
  auth: {
    login: '登录',
    logout: '退出登录',
    loginSuccess: '登录成功',
    loginFailed: '登录失败',
    logoutSuccess: '退出成功',
    logoutConfirm: '确定要退出登录吗？',
    sessionExpired: '登录已过期，请重新登录',
    unauthorized: '无权访问',
    ssoRedirect: '正在跳转到统一认证服务...',
    ssoLogin: '使用 Funk & Love 账号登录',
    ssoHint: '点击上方按钮将跳转到统一认证服务',
    welcomeBack: '欢迎回到 LockCloud',
    pleaseLogin: '请先登录',
    goLogin: '去登录',
    configError: '无法获取登录配置，请稍后重试',
    openLoginError: '无法打开登录页面，请稍后重试',
    verifyFailed: '登录验证失败',
  },

  // Navigation
  nav: {
    files: '文件',
    upload: '上传',
    requests: '请求',
    profile: '我的',
    explore: '浏览',
  },

  // Files
  files: {
    title: '文件',
    upload: '上传文件',
    uploadSuccess: '上传成功',
    uploadFailed: '上传失败',
    deleteSuccess: '删除成功',
    deleteFailed: '删除失败',
    deleteConfirm: '确认删除此文件？',
    deleteConfirmTitle: '确认删除',
    deleteWarning: '删除后将无法恢复，请确认是否继续。',
    deleteIrreversible: '删除操作不可撤销',
    noPermission: '您无权删除此文件',
    notOwnerHint: '您不是此文件的上传者，删除请求将发送给上传者审批。',
    fileName: '文件名',
    fileSize: '文件大小',
    uploadDate: '上传日期',
    uploader: '上传者',
    directory: '目录',
    selectDirectory: '选择目录',
    selectFile: '选择文件',
    uploading: '上传中...',
    deleting: '删除中...',
    fileCount: '个文件',
    noFiles: '暂无文件',
    noFilesHint: '上传一些文件开始使用',
    adjustFilters: '尝试调整筛选条件',
    activityDate: '活动日期',
    activityType: '活动类型',
    activityName: '活动名称',
    originalFileName: '原始文件名',
    legacyFile: '旧格式',
    noTags: '无标签',
    loadFailed: '加载失败',
    checkNetwork: '请检查网络连接',
    targetFile: '目标文件',
    size: '大小',
    unknown: '未知',
  },

  // Filters
  filters: {
    all: '全部',
    images: '图片',
    videos: '视频',
    dateRange: '日期范围',
    uploader: '上传者',
    directory: '目录',
    startDate: '开始日期',
    endDate: '结束日期',
    activityType: '活动类型',
    activityName: '活动名称',
    search: '搜索文件名',
    searchPlaceholder: '输入文件名搜索',
    apply: '应用',
    reset: '重置',
    total: '共',
    count: '个',
    mediaType: '媒体类型',
  },

  // Tags
  tags: {
    title: '标签',
    addTag: '添加标签',
    removeTag: '移除标签',
    addTags: '补充标签',
    updateTags: '更新标签',
    tagsUpdated: '标签已更新',
    noTags: '暂无标签',
    noTagsHint: '添加标签可以帮助您更好地组织和查找文件',
    searchOrInput: '搜索或输入标签...',
    noMatchingTags: '没有匹配的标签',
    clickToCreate: '点击「添加」创建新标签',
    inputTagName: '输入标签名称搜索',
    enterTagName: '请输入标签名称',
    tagButton: '+ 标签',
  },

  // Activity Types
  activityTypes: {
    title: '活动类型',
    selectType: '请选择活动类型',
    loading: '加载中...',
    loadFailed: '无法加载活动类型，请重试',
    noChange: '不修改',
  },

  // Upload
  upload: {
    title: '上传文件',
    uploadInfo: '上传信息',
    selectFiles: '选择文件',
    selectFromGallery: '从相册选择',
    takePhoto: '拍照',
    selectedCount: '已选择 {count} 个文件',
    clearSelection: '清除选择',
    addToQueue: '添加到上传队列',
    addingToQueue: '添加中...',
    addedToQueue: '已添加到队列',
    addedToQueueMessage: '{count} 个文件已添加到上传队列',
    addFailed: '无法添加文件到队列，请重试',
    selectAtLeastOne: '请至少选择一个文件',
    formError: '请填写所有必填字段',
    required: '此字段为必填项',
    optional: '可选',
    customFilename: '自定义文件名',
    customFilenameHint: '留空则使用原文件名',
    originalFilename: '原文件名',
    maxLength: '最多{max}字符',
    dateFormat: 'YYYY-MM-DD',
    datePlaceholder: '请选择日期',
    activityNamePlaceholder: '如：周末团建、新年晚会',
  },

  // Upload Queue
  uploadQueue: {
    title: '上传队列',
    empty: '暂无上传任务',
    emptyHint: '选择文件后将显示在这里',
    clearCompleted: '清除已完成',
    status: {
      pending: '等待中',
      uploading: '上传中',
      success: '已完成',
      error: '失败',
    },
    retry: '重试',
    cancel: '取消',
    remove: '移除',
    uploading: '{count} 个上传中',
    waiting: '{count} 个等待中',
    justNow: '刚刚',
    minutesAgo: '{count} 分钟前',
    hoursAgo: '{count} 小时前',
    files: '个文件',
  },

  // Requests
  requests: {
    title: '请求',
    received: '收到的请求',
    sent: '发出的请求',
    noRequests: '暂无请求',
    receivedEmpty: '当其他用户请求编辑您的文件时，会显示在这里',
    sentEmpty: '当您请求编辑其他用户的文件时，会显示在这里',
    createRequest: '创建请求',
    sendRequest: '发送请求',
    sending: '发送中...',
    requestSent: '请求已发送',
    requestFailed: '发送请求失败，请重试',
    approve: '批准',
    reject: '拒绝',
    approveConfirm: '确定要批准此请求吗？',
    rejectConfirm: '确定要拒绝此请求吗？',
    confirmApprove: '确认批准',
    confirmReject: '确认拒绝',
    status: {
      all: '全部',
      pending: '待处理',
      approved: '已批准',
      rejected: '已拒绝',
    },
    type: {
      edit: '编辑请求',
      delete: '删除请求',
      directory_edit: '目录编辑',
    },
    from: '来自',
    to: '发送给',
    unknownUser: '未知用户',
    proposedChanges: '修改内容',
    atLeastOneChange: '请至少填写一项修改内容',
    message: '留言',
    messagePlaceholder: '请说明请求原因...',
    response: '回复',
    newFilename: '新文件名',
    newActivityDate: '活动日期 (YYYY-MM-DD)',
    newActivityType: '活动类型',
    newActivityName: '活动名称',
    newTags: '标签 (逗号分隔)',
    instructor: '带训老师',
    deleteWarning: '删除请求将请求文件所有者删除此文件。此操作不可撤销。',
    fileDeleted: '文件已删除',
  },

  // Batch Operations
  batch: {
    selected: '已选择 {count} 项',
    edit: '编辑',
    addTag: '加标签',
    removeTag: '移标签',
    delete: '删除',
    confirmDelete: '确定要删除选中的 {count} 个文件吗？',
    skipNonOwned: '{count} 个非本人上传的文件将被跳过',
    noFilesToDelete: '没有可删除的文件（只能删除自己上传的文件）',
    noFilesToOperate: '没有可操作的文件（只能修改自己上传的文件）',
    deleteSuccess: '成功删除 {count} 个文件',
    deletePartial: '成功删除 {succeeded} 个文件，{failed} 个失败',
    addTagSuccess: '成功为 {count} 个文件添加标签',
    removeTagSuccess: '成功从 {count} 个文件移除标签',
    updateSuccess: '成功更新 {count} 个文件',
    updatePartial: '成功更新 {succeeded} 个文件，{failed} 个失败',
    selectTagToRemove: '请选择要移除的标签',
    noTagsInSelection: '选中的文件没有标签',
    batchEdit: '批量编辑',
    editHint: '留空的字段将保持原值不变',
    confirmEdit: '确认修改',
    confirmAdd: '确认添加',
    confirmRemove: '确认移除',
    enterTagName: '输入标签名称...',
    operationFailed: '操作失败，请重试',
  },

  // Profile
  profile: {
    title: '我的',
    user: '用户',
    role: '角色',
    permission: '权限',
    admin: '管理员',
    normalUser: '普通用户',
    logout: '退出登录',
    confirmLogout: '确认退出',
  },

  // Empty States
  empty: {
    files: '暂无文件',
    filesHint: '您还没有上传任何文件，点击下方按钮开始上传',
    uploadFiles: '上传文件',
    searchResults: '未找到结果',
    searchResultsHint: '没有找到符合条件的内容',
    searchResultsWithTerm: '没有找到与"{term}"相关的内容',
    clearFilters: '清除筛选',
    requests: '暂无请求',
    tags: '暂无标签',
    tagsHint: '添加标签可以帮助您更好地组织和查找文件',
    uploadQueue: '上传队列为空',
    uploadQueueHint: '选择文件后，它们将显示在这里等待上传',
    selection: '未选择文件',
    selectionHint: '长按文件卡片进入选择模式，然后点击选择要操作的文件',
    offline: '您已离线',
    offlineHint: '部分功能可能不可用，请检查网络连接',
    offlineCached: '正在显示缓存内容',
    reconnect: '重新连接',
    reconnecting: '正在重新连接...',
    backOnline: '已恢复网络连接',
    comingSoon: '即将推出',
    comingSoonHint: '此功能正在开发中，敬请期待',
    comingSoonFeature: '{feature}功能正在开发中，敬请期待',
  },

  // Errors
  errors: {
    networkError: '网络连接失败',
    networkErrorHint: '请检查您的网络设置，然后重试',
    serverError: '服务器错误',
    serverErrorHint: '服务器暂时无法响应，请稍后再试',
    notFound: '内容不存在',
    notFoundHint: '您访问的内容不存在或已被删除',
    forbidden: '访问被拒绝',
    forbiddenHint: '您没有权限访问此内容',
    permissionDenied: '权限不足',
    unknown: '未知错误',
    operationFailed: '操作失败，请重试',
    invalidDate: '日期格式无效，应为YYYY-MM-DD格式',
    invalidActivityType: '活动类型无效，请从列表中选择',
    fileNotFound: '文件不存在',
    fileSizeExceeded: '文件大小超出限制',
    unsupportedFileType: '不支持的文件类型',
    uploadFailed: '上传失败，请重试',
    fileLoadFailed: '文件加载失败',
    videoPlaybackFailed: '视频播放失败',
    imageLoadFailed: '图片加载失败',
    reconnect: '重新连接',
    goBack: '返回',
    clickToRetry: '点击重新加载',
  },

  // Units
  units: {
    bytes: '字节',
    kb: 'KB',
    mb: 'MB',
    gb: 'GB',
    year: '年',
    month: '月',
    day: '日',
    hour: '时',
    minute: '分',
    second: '秒',
  },

  // Time
  time: {
    justNow: '刚刚',
    minutesAgo: '{count} 分钟前',
    hoursAgo: '{count} 小时前',
    daysAgo: '{count} 天前',
    today: '今天',
    yesterday: '昨天',
  },

  // File Detail
  fileDetail: {
    title: '文件详情',
    metadata: '文件信息',
    preview: '预览',
    actions: '操作',
    editFile: '编辑文件',
    deleteFile: '删除文件',
    requestEdit: '请求编辑',
    previousFile: '上一个',
    nextFile: '下一个',
    noPreview: '无法预览此文件',
    downloadOriginal: '下载原文件',
  },

  // Edit File
  editFile: {
    title: '编辑文件',
    saveChanges: '保存修改',
    saving: '保存中...',
    saveSuccess: '保存成功',
    saveFailed: '保存失败，请重试',
  },

  // Media Viewer
  mediaViewer: {
    zoomIn: '放大',
    zoomOut: '缩小',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    play: '播放',
    pause: '暂停',
  },

  // Selection Mode
  selection: {
    enterMode: '进入选择模式',
    exitMode: '退出选择模式',
    selectAll: '全选',
    deselectAll: '取消全选',
    selectedCount: '已选择 {count} 项',
    longPressHint: '长按文件卡片进入选择模式',
  },

  // Validation
  validation: {
    required: '此字段为必填项',
    invalidFormat: '格式无效',
    tooLong: '内容过长',
    tooShort: '内容过短',
    invalidDate: '日期格式无效',
    selectRequired: '请选择一项',
  },

  // Accessibility
  accessibility: {
    loading: '正在加载',
    loaded: '加载完成',
    error: '发生错误',
    button: '按钮',
    selected: '已选中',
    notSelected: '未选中',
    expanded: '已展开',
    collapsed: '已收起',
    close: '关闭',
    open: '打开',
    menu: '菜单',
    back: '返回',
    next: '下一个',
    previous: '上一个',
  },
};

export type Translations = typeof zhCN;

/**
 * Helper function to get a translation with interpolation
 * @param key - The translation key (e.g., 'common.loading')
 * @param params - Optional parameters for interpolation
 * @returns The translated string
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: unknown = zhCN;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }
  
  if (typeof value !== 'string') {
    console.warn(`Translation value is not a string: ${key}`);
    return key;
  }
  
  // Handle interpolation
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
      return params[paramKey]?.toString() ?? `{${paramKey}}`;
    });
  }
  
  return value;
}

export default zhCN;
