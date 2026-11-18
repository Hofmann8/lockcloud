/** 站点信息：「关于」从这里取。备案号放在主站，这里不放。 */
export const SITE = {
  builders: ['Hofmann', '萝卜'],
  owner: 'Funk & Love',
  github: 'https://github.com/Hofmann8/lockcloud',
  // 版本号在 package.json 里改（next.config.ts 构建时注入）；「2.0.0」显示成「2.0」
  version: (process.env.APP_VERSION ?? '').replace(/\.0$/, ''),
} as const;
