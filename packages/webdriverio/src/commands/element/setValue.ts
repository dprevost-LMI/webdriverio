import { getBrowserObject, isAppiumCapability } from '@wdio/utils'

/**
 * Send a sequence of key strokes to an element after the input has been cleared before. If the element doesn't need
 * to be cleared first then use [`addValue`](/docs/api/element/addValue).
 *
 * :::info
 *
 * If you like to use special characters, e.g. to copy and paste a value from one input to another, use the
 * [`keys`](/docs/api/browser/keys) command.
 *
 * :::
 *
 * <example>
    :setValue.js
    it('should set value for a certain element', async () => {
        const input = await $('.input');
        await input.setValue('test')
        await input.setValue(123)

        console.log(await input.getValue()); // outputs: '123'
    });
 * </example>
 *
 * @alias element.setValue
 * @param {string | number}  value  value to be added
 *
 */
export async function setValue (
    this: WebdriverIO.Element,
    value: string | number,
    mask = false
) {
    await this.clearValue()

    if (mask && typeof value === 'string') {
        const isAppiumEnabled = isAppiumCapability(getBrowserObject(this).capabilities)
        if (isAppiumEnabled) {
            // First regex to mask the value for app entry like `Calling AppiumDriver-setValue() with args: ["myPassword","00000000-0000-0d8c-0000-00eb000000ca","62397a2-27d4-43dc-be63-bfb4c94550"]`
            const firstLetter = value[0]
            const lastLetter = value[value.length - 1]
            const length = value.length
            const maskingRegEx = `.*${firstLetter}.{${length - 2}}${lastLetter}.*`

            // Second regex is to cover case like `Added 'value' property ["m", "y", "P", "a", "s", "s", "w", "o", "r","d"] to 'setValue' request body`
            const maskingWithComaRegEx = `.*${firstLetter}(,.){${length - 2}},${lastLetter}.*`
            this.updateSettings({ newMaskingRules:  [maskingRegEx, maskingWithComaRegEx] })
        }
    }

    return this.addValue(value, mask)
}
