/**
 * Quick Response Utility - Ensures commands respond within Discord's 3-second timeout
 * Uses immediate acknowledgement + async processing
 */

export async function quickReply(interaction, processingFn) {
  try {
    // Step 1: IMMEDIATE response (within 1 second)
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }

    // Step 2: Send "processing" message IMMEDIATELY
    const processingMsg = '⏳ Procesando...';
    await interaction.editReply({ content: processingMsg }).catch(() => {});

    // Step 3: Process in background (async, no wait)
    setImmediate(async () => {
      try {
        const result = await processingFn();
        
        // Step 4: Update with final result
        if (result.embeds) {
          await interaction.editReply({ embeds: result.embeds, content: '' }).catch(() => {});
        } else if (result.content) {
          await interaction.editReply({ content: result.content }).catch(() => {});
        }
      } catch (err) {
        console.error('[QUICK-RESPONSE] Processing error:', err.message);
        await interaction.editReply({
          content: `❌ Error: ${err.message}`
        }).catch(() => {});
      }
    });

  } catch (error) {
    console.error('[QUICK-RESPONSE] Reply error:', error.message);
  }
}

export default { quickReply };