import { Html, Head, Main, NextScript } from 'next/document';

// Required for Next.js 14 App Router + Pages Router coexistence.
// Prevents the "<Html> should not be imported outside of pages/_document"
// error that occurs when Next.js generates /_error pages internally.
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
