import { chromium, Page } from 'playwright';
import { Settings, Kind } from './settings';

async function session<T>(settings: Settings, action: (page: Page) => Promise<T>): Promise<T> {
  if (!settings.group || !settings.user || !settings.password) throw new Error('Configure suas credenciais.');
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
  try {
    const page = await browser.newPage({ timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' });
    page.setDefaultTimeout(30_000);
    await page.goto('https://easymob.metadados.com.br/Account/LoginColaborador', { waitUntil: 'domcontentloaded' });
    const understood = page.getByRole('button', { name: 'Entendi', exact: true });
    if (await understood.isVisible()) await understood.click();
    await page.locator('#chave').fill(settings.group);
    await page.locator('#usuario').fill(settings.user);
    await page.locator('#senha').fill(settings.password);
    await page.locator('#btnLogin').click();
    await page.locator('#btnLogin').waitFor({ state: 'hidden' });
    return await action(page);
  } finally {
    await browser.close();
  }
}

export async function register(settings: Settings, dryRun: boolean, kind: Kind, beforeClick: () => void): Promise<string> {
  if (!dryRun && !process.env.EASYMOB_SUCCESS_SELECTOR) throw new Error('Configure o seletor de confirmação.');
  return session(settings, async page => {
    const button = process.env.EASYMOB_BUTTON_SELECTOR
      ? page.locator(process.env.EASYMOB_BUTTON_SELECTOR)
      : page.getByRole('button', { name: /regist[ar]+ ponto/i });
    await button.waitFor({ state: 'visible' });
    if (await button.count() !== 1) throw new Error('Botão de ponto ambíguo. Configure o seletor.');
    const typeSelector = process.env.EASYMOB_TYPE_SELECTOR;
    if (typeSelector) {
      const values = JSON.parse(process.env.EASYMOB_TYPE_VALUES || '{}');
      if (typeof values[kind] !== 'string') throw new Error('Mapeie o tipo no EASYMOB_TYPE_VALUES.');
      await page.locator(typeSelector).selectOption(values[kind]);
    }
    if (dryRun) return 'Login e botão verificados; nenhum ponto foi registrado.';
    if (!typeSelector && ['inicio_extra', 'fim_extra'].includes(kind)) throw new Error('Configure o mapeamento do tipo de ponto extra no portal.');
    const success = page.locator(process.env.EASYMOB_SUCCESS_SELECTOR!);
    if (await success.isVisible()) throw new Error('Indicador de sucesso já visível antes do clique. Revise o seletor.');
    beforeClick();
    await button.click();
    await success.waitFor({ state: 'visible' });
    return 'Confirmação de registro identificada no EasyMOB.';
  });
}

export async function fetchPunches(settings: Settings): Promise<string[][]> {
  const selector = process.env.EASYMOB_PUNCHES_SELECTOR;
  if (!selector) throw new Error('Configure EASYMOB_PUNCHES_SELECTOR para a tabela de marcações do portal.');
  return session(settings, async page => {
    const target = process.env.EASYMOB_PUNCHES_URL;
    if (target) {
      const url = new URL(target, 'https://easymob.metadados.com.br');
      if (url.origin !== 'https://easymob.metadados.com.br') throw new Error('URL de marcações inválida.');
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    }
    const table = page.locator(selector);
    await table.waitFor({ state: 'visible' });
    return table.locator('tr').evaluateAll(rows => rows.map(row =>
      Array.from(row.querySelectorAll('th,td')).map(cell => cell.textContent?.trim() || '')
    ).filter(row => row.length > 0));
  });
}
