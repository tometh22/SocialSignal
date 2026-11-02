import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StatusText, { normalizeStatusText } from '../client/src/components/review/StatusText';

const render = (text: string) => renderToStaticMarkup(createElement(StatusText, { children: text }));

describe('Status text imported from messages', () => {
  it('renders WhatsApp bullets as separate list items, including invisible separators', () => {
    const html = render('Novedades\n•\u2060  Unilever: pidió demo\n•\u00a0 Boehringer: esperando respuesta');
    expect(html).toContain('<ul>');
    expect(html.match(/<li>/g)).toHaveLength(2);
    expect(html).toContain('Unilever: pidió demo');
    expect(html).toContain('Boehringer: esperando respuesta');
  });

  it('keeps blank lines, single line breaks and nested lists', () => {
    const text = 'Primer párrafo\nsegunda línea\n\n• Tema\n  ◦ Subtema\n\nCierre';
    const html = render(text);
    expect(html).toContain('Primer párrafo\nsegunda línea');
    expect(html.match(/<ul>/g)).toHaveLength(2);
    expect(html).toContain('<p>Cierre</p>');
    expect(normalizeStatusText('•\n\nPárrafo')).toBe('•\n\nPárrafo');
  });

  it('supports numbered lists and emphasis without changing the source text', () => {
    const text = '**Pendientes**\n\n1. Enviar brief\n2. Pedir respuesta';
    expect(normalizeStatusText(text)).toBe(text);
    const html = render(text);
    expect(html).toContain('<strong>Pendientes</strong>');
    expect(html).toContain('<ol>');
    expect(html.match(/<li>/g)).toHaveLength(2);
  });

  it('does not interpret a bullet inside a sentence as a list', () => {
    expect(normalizeStatusText('Estado • sigue en proceso\r\nPróxima línea')).toBe('Estado • sigue en proceso\nPróxima línea');
  });

  it('does not execute pasted HTML or load remote images', () => {
    const html = render('<script>alert(1)</script>\n\n[click](javascript:alert%281%29)\n\n![adjunto](https://example.com/private.png)');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('<img');
    expect(html).toContain('adjunto');
  });
});
