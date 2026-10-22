import { chromium } from 'playwright';

export async function register(dryRun: boolean, beforeClick: () => void): Promise<string> {
  for (const name of ['EASYMOB_GROUP', 'EASYMOB_USER', 'EASYMOB_PASSWORD']) {
    if (!process.env[name]) throw new Error('Credenciais incompletas no .env.');
  }
  if (!dryRun && !process.env.EASYMOB_SUCCESS_SELECTOR) {
    throw new Error('Configure EASYMOB_SUCCESS_SELECTOR antes de ativar registros reais.');
  }
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
  try {
    const page = await browser.newPage({ timezoneId: 'America/Sao_Paulo', locale: 'pt-BR' });
    page.setDefaultTimeout(30_000);
    await page.goto('https://easymob.metadados.com.br/Account/LoginColaborador', { waitUntil: 'domcontentloaded' });
    const understood = page.getByRole('button', { name: 'Entendi', exact: true });
    if (await understood.isVisible()) await understood.click();
    await page.locator('#chave').fill(process.env.EASYMOB_GROUP!);
    await page.locator('#usuario').fill(process.env.EASYMOB_USER!);
    await page.locator('#senha').fill(process.env.EASYMOB_PASSWORD!);
    await page.locator('#btnLogin').click();
    const button = process.env.EASYMOB_BUTTON_SELECTOR
      ? page.locator(process.env.EASYMOB_BUTTON_SELECTOR)
      : page.getByRole('button', { name: /regist[ar]+ ponto/i });
    await button.waitFor({ state: 'visible' });
    if (await button.count() !== 1) throw new Error('Botão de ponto ambíguo. Configure o seletor.');
    if (dryRun) return 'Login e botão verificados; nenhum ponto foi registrado.';
    const success = page.locator(process.env.EASYMOB_SUCCESS_SELECTOR!);
    if (await success.isVisible()) throw new Error('Indicador de sucesso já visível antes do clique. Revise o seletor.');
    beforeClick();
    await button.click();
    await success.waitFor({ state: 'visible' });
    return 'Confirmação de registro identificada no EasyMOB.';
  } finally {
    await browser.close();
  }
}
