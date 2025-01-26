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

    // TODO add this config somewhere
    const appiumMaskingEnabled = true
    if (mask && appiumMaskingEnabled && typeof value === 'string') {

        if (appiumMaskingEnabled) {
        // First regex: uses the first letter, the last letter, and the length of the string
            const firstLetter = value[0]
            const lastLetter = value[value.length - 1]
            const length = value.length
            const maskingRegEx = `.*${firstLetter}.{${length - 2}}${lastLetter}.*`

            // Second regex: covers the case where each letter is separated by a comma
            const maskingWithComaRegEx = `.*${firstLetter}(,.){${length - 2}},${lastLetter}.*`

            this.updateSettings({ newMaskingRules:  [maskingRegEx, maskingWithComaRegEx] })
        }
    }

    return this.addValue(value, mask)
}
