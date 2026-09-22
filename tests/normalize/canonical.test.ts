import { isTag, isComment, type Element } from 'domhandler';
import { describe, expect, it } from 'vitest';
import { parsePage } from '../../src/locks/locate.js';
import { canonicalize } from '../../src/normalize/canonical.js';

function select(html: string, selector: string): Element {
  const node = parsePage(html)(selector).get(0);
  if (node === undefined || !isTag(node)) {
    throw new Error(`No element matches ${selector}`);
  }
  return node;
}

function canon(html: string, selector: string): string {
  return canonicalize(select(html, selector));
}

describe('markup churn that must compare equal', () => {
  it('ignores attribute order', () => {
    expect(canon('<p id="a" title="b">x</p>', 'p'))
      .toBe(canon('<p title="b" id="a">x</p>', 'p'));
  });

  it('drops the whole class attribute, hashed or not', () => {
    const hashed = canon('<p class="css-1q2w3e">x</p>', 'p');
    expect(hashed).toBe(canon('<p class="css-9z8y7x">x</p>', 'p'));
    expect(hashed).toBe(canon('<p>x</p>', 'p'));
    expect(hashed).toBe('<p>x</p>');
  });

  it('drops every data-* attribute including data-locked', () => {
    expect(canon('<p data-locked="f" data-v="1">x</p>', 'p')).toBe(canon('<p>x</p>', 'p'));
  });

  it('drops the style attribute', () => {
    expect(canon('<p style="color:red">x</p>', 'p')).toBe(canon('<p>x</p>', 'p'));
  });

  it('drops Angular, Vue and Alpine runtime attributes', () => {
    expect(canon('<p _ngcontent-abc="" v-if="x" x-data="y">t</p>', 'p')).toBe(canon('<p>t</p>', 'p'));
  });

  it('drops the _nghost attribute', () => {
    expect(canon('<p _nghost-abc="">t</p>', 'p')).toBe(canon('<p>t</p>', 'p'));
  });

  it('removes comments at any depth', () => {
    expect(canon('<div><!-- c -->x</div>', 'div')).toBe(canon('<div>x</div>', 'div'));
    expect(canon('<div><p>x<!-- deep --></p></div>', 'div')).toBe(canon('<div><p>x</p></div>', 'div'));
  });

  it('compares decoded attribute values, not their source quoting', () => {
    const escaped = canon('<p title="a&amp;b">x</p>', 'p');
    expect(escaped).toBe(canon(`<p title='a&b'>x</p>`, 'p'));
    expect(escaped).toBe('<p title="a&amp;b">x</p>');
  });

  it('collapses runs of whitespace inside text', () => {
    const single = canon('<div>a b</div>', 'div');
    expect(canon('<div>a   b</div>', 'div')).toBe(single);
    expect(canon('<div>a\n\n  b</div>', 'div')).toBe(single);
    expect(single).toBe('<div>a b</div>');
  });

  it('treats a non-breaking space as ordinary whitespace', () => {
    expect(canon('<div>a&nbsp;b</div>', 'div')).toBe(canon('<div>a b</div>', 'div'));
  });

  it('ignores indentation between elements', () => {
    const ragged = ['<ul>', '  <li>a</li>', '  <li>b</li>', '</ul>'].join('\n');
    expect(canon(ragged, 'ul')).toBe(canon('<ul><li>a</li><li>b</li></ul>', 'ul'));
    expect(canon(ragged, 'ul')).toBe('<ul><li>a</li><li>b</li></ul>');
  });
});

describe('real changes that must compare different', () => {
  it('sees changed text', () => {
    expect(canon('<p>hello</p>', 'p')).not.toBe(canon('<p>hullo</p>', 'p'));
  });

  it('sees a changed attribute value', () => {
    expect(canon('<p id="a">x</p>', 'p')).not.toBe(canon('<p id="b">x</p>', 'p'));
  });

  it('retains id, so adding one is a change', () => {
    expect(canon('<p id="a">x</p>', 'p')).not.toBe(canon('<p>x</p>', 'p'));
    expect(canon('<p id="a">x</p>', 'p')).toBe('<p id="a">x</p>');
  });

  it('sees an added wrapper', () => {
    expect(canon('<div><p>x</p></div>', 'div'))
      .not.toBe(canon('<div><span><p>x</p></span></div>', 'div'));
  });

  it('sees reordered children', () => {
    expect(canon('<div><p>a</p><p>b</p></div>', 'div'))
      .not.toBe(canon('<div><p>b</p><p>a</p></div>', 'div'));
  });

  it('sees a changed tag', () => {
    expect(canon('<div><p>x</p></div>', 'div')).not.toBe(canon('<div><h2>x</h2></div>', 'div'));
  });

  it('preserves whitespace inside pre', () => {
    expect(canon('<pre>a   b</pre>', 'pre')).not.toBe(canon('<pre>a b</pre>', 'pre'));
    expect(canon('<pre>a   b</pre>', 'pre')).toBe('<pre>a   b</pre>');
  });

  it('preserves whitespace inside textarea', () => {
    expect(canon('<textarea>a   b</textarea>', 'textarea'))
      .not.toBe(canon('<textarea>a b</textarea>', 'textarea'));
  });

  it('preserves whitespace nested inside pre', () => {
    expect(canon('<pre><code>a   b</code></pre>', 'pre'))
      .not.toBe(canon('<pre><code>a b</code></pre>', 'pre'));
  });
});

describe('serialization details', () => {
  it('writes void elements without a closing tag', () => {
    expect(canon('<img src="a.png">', 'img')).toBe('<img src="a.png">');
    expect(canon('<div><br></div>', 'div')).toBe('<div><br></div>');
  });

  it('writes a valueless attribute with an empty value', () => {
    expect(canon('<input disabled>', 'input')).toBe('<input disabled="">');
  });

  it('sorts attributes by name', () => {
    expect(canon('<p title="t" id="i" aria-label="a">x</p>', 'p'))
      .toBe('<p aria-label="a" id="i" title="t">x</p>');
  });

  it('escapes markup characters in text', () => {
    expect(canon('<p>a &lt; b &amp; c &gt; d</p>', 'p')).toBe('<p>a &lt; b &amp; c &gt; d</p>');
  });

  it('escapes a double quote in an attribute value', () => {
    expect(canon(`<p title='say "hi"'>x</p>`, 'p')).toBe('<p title="say &quot;hi&quot;">x</p>');
  });
});

describe('input tree', () => {
  it('is left untouched by canonicalization', () => {
    const element = select('<p class="css-1q2w3e" data-locked="L">x<!-- c --></p>', 'p');
    canonicalize(element);
    expect(element.attribs['class']).toBe('css-1q2w3e');
    expect(element.attribs['data-locked']).toBe('L');
    expect(element.children.some(isComment)).toBe(true);
  });
});

describe('a realistic locked footer', () => {
  const generated = [
    '<footer data-locked="site-footer" class="css-1a2b3c footer--dark" style="padding:2rem">',
    '  <!-- footer start -->',
    '  <div class="css-9z8y7x">',
    '    <div class="css-row">',
    '      <p class="css-abc">&copy; 2026 Acme,&nbsp;Inc.</p>',
    '      <ul class="css-def">',
    '        <li><a class="css-l1" href="/privacy">Privacy</a></li>',
    '        <li><a class="css-l2" href="/terms">Terms</a></li>',
    '      </ul>',
    '    </div>',
    '  </div>',
    '  <!-- footer end -->',
    '</footer>',
  ].join('\n');

  const baseline = '<footer data-locked="site-footer"><div><div>'
    + '<p>&copy; 2026 Acme, Inc.</p>'
    + '<ul><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li></ul>'
    + '</div></div></footer>';

  it('canonicalizes to the hand-written compact equivalent', () => {
    expect(canon(generated, 'footer')).toBe(canon(baseline, 'footer'));
  });

  it('canonicalizes to the expected literal form', () => {
    expect(canon(generated, 'footer')).toBe(
      '<footer><div><div><p>© 2026 Acme, Inc.</p>'
      + '<ul><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li></ul>'
      + '</div></div></footer>',
    );
  });
});
