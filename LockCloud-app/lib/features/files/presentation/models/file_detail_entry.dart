class FileDetailEntry {
  final int fileId;
  final String? thumbhash;
  final String? thumbnailUrl;
  final String? thumbnailCacheKey;
  final bool isVideo;
  final String? filename;

  const FileDetailEntry({
    required this.fileId,
    this.thumbhash,
    this.thumbnailUrl,
    this.thumbnailCacheKey,
    this.isVideo = false,
    this.filename,
  });
}
