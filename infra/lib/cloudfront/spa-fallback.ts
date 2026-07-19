/**
 * SPA フォールバックの判定ロジック (正の単一根拠)。
 *
 * 拡張子付き URI (例: .js, .css, .html, .svg, .png, .ico) はそのまま S3 へ通し、拡張子なしは
 * SPA クライアントルートとみなして `/index.html` へ書換える (S3 が常に存在する object を返す
 * 状態にし、missing object error を未然に防ぐ)。CloudFront Function (JS_2_0) は `import` 不可の
 * ため、app-stack.ts の `FunctionCode.fromInline` ハンドラに同じロジックを手動で写経し「要同期」
 * コメントで本モジュールを指す。本モジュールがテストの単一根拠。
 *
 * querystring は判定対象外: CloudFront Function の `request.uri` はパス部分のみを保持し
 * (querystring は `request.querystring` に分離される契約) 、この関数に querystring 付き文字列が
 * 渡ることはない。
 */

/** 拡張子有無を判定し、無ければ SPA エントリポイントの URI へ解決する。 */
export function resolveSpaFallbackUri(uri: string): string {
  if (/\.[a-zA-Z0-9]+$/.test(uri)) return uri
  return '/index.html'
}
