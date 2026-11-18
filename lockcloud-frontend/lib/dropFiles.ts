// 拖放进来的文件。拖的是文件夹时 dataTransfer.files 里只有文件夹本身，要顺着目录项一层层读出来。

function readAll(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    // readEntries 一次只给一批，读到空为止
    const next = () =>
      reader.readEntries((batch) => {
        if (!batch.length) resolve(all);
        else {
          all.push(...batch);
          next();
        }
      }, reject);
    next();
  });
}

async function walk(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.name.startsWith('.')) return;
  if (entry.isFile) {
    out.push(await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)));
    return;
  }
  for (const child of await readAll((entry as FileSystemDirectoryEntry).createReader())) await walk(child, out);
}

/**
 * 拖进来的全部文件，文件夹展开成里面的文件（隐藏文件不要）。
 * 要在 drop 事件里同步调用：事件处理完 dataTransfer 就清空了。
 */
export function filesFromDrop(dt: DataTransfer | null): Promise<File[]> {
  if (!dt) return Promise.resolve([]);
  const plain = [...dt.files];
  const entries = [...dt.items]
    .map((item) => (item.kind === 'file' ? item.webkitGetAsEntry?.() ?? null : null))
    .filter((e): e is FileSystemEntry => !!e);
  if (!entries.some((e) => e.isDirectory)) return Promise.resolve(plain);
  return (async () => {
    const out: File[] = [];
    for (const entry of entries) {
      try {
        await walk(entry, out);
      } catch {
        // 读不了的目录跳过，其余照常
      }
    }
    return out;
  })();
}
