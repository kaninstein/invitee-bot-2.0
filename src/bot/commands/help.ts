import { Context } from 'telegraf';
import { blofinService } from '../../services/blofinService';
import { i18nService } from '../../services/i18nService';

export async function helpCommand(ctx: Context) {
  try {
    const telegramUser = ctx.from;
    const helpMessage = `
${i18nService.t('help.title')}

${i18nService.t('help.aboutBot')}

${i18nService.t('help.availableCommands')}

${i18nService.t('help.commands.start')}
${i18nService.t('help.commands.register')}
${i18nService.t('help.commands.status')}
${i18nService.t('help.commands.help')}

${i18nService.t('help.howItWorks')}

${i18nService.t('help.step1')}

${i18nService.t('help.step2')}

${i18nService.t('help.step3')}

${i18nService.t('help.blofinLink')}
${blofinService.generateReferralLink(telegramUser?.id.toString())}

${i18nService.t('help.commonProblems')}

${i18nService.t('help.support')}

${i18nService.t('help.important')}

${i18nService.t('help.tips')}

${i18nService.t('help.remember')}
    `.trim();

    await ctx.reply(helpMessage, { 
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true }
    });

  } catch (error) {
    console.error('Error in help command:', error);
    await ctx.reply(
      i18nService.t('general.error')
    );
  }
}