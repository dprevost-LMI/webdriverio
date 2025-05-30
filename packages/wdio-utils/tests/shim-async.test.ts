import path from 'node:path'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

import { executeHooksWithArgs, executeAsync, wrapCommand } from '../src/shim.js'

const globalAny: any = global

vi.mock('@wdio/logger', () => import(path.join(process.cwd(), '__mocks__', '@wdio/logger')))

beforeEach(() => {
    globalAny.browser = {} as WebdriverIO.Browser
})

afterEach(() => {
    delete globalAny.browser
})

describe('executeHooksWithArgs', () => {
    it('multiple hooks, multiple args', async () => {
        const hookHoge = () => { return 'hoge' }
        const hookFuga = () => { return 'fuga' }
        const argHoge = { hoge: 'hoge' }
        const argFuga = { fuga: 'fuga' }
        const res = await executeHooksWithArgs('hookName', [hookHoge, hookFuga], [argHoge, argFuga])
        expect(res).toEqual(['hoge', 'fuga'])
    })

    it('one hook, one arg', async () => {
        const hook = () => { return 'hoge' }
        const arg = { hoge: 'hoge' }
        // @ts-ignore test with invalid param
        const res = await executeHooksWithArgs('hookName', hook, arg)
        expect(res).toHaveLength(1)
        expect(res).toContain('hoge')
    })

    it('with error', async () => {
        const hook = () => { throw new Error('Hoge') }
        const res = await executeHooksWithArgs('hookName', hook, [])
        expect(res).toHaveLength(1)
        expect(res).toEqual([new Error('Hoge')])
    })

    it('return promise with error', async () => {
        const hook = () => {
            return new Promise(() => { throw new Error('Hoge') })
        }
        const res = await executeHooksWithArgs('hookName', hook, [])
        expect(res).toHaveLength(1)
        expect(res).toEqual([new Error('Hoge')])
    })

    it('async functions', async () => {
        const hookHoge = () => {
            return new Promise(reject => setTimeout(reject, 5, new Error('Hoge')))
        }
        const hookFuga = async () => new Promise(resolve => setTimeout(resolve, 10, 'fuga'))
        const res = await executeHooksWithArgs('hookName', [hookHoge, hookFuga], [])
        expect(res).toEqual([new Error('Hoge'), 'fuga'])
    })
})

describe('executeAsync', () => {
    it('should pass with default values and fn returning synchronous value', async () => {
        const result = await executeAsync.call({}, async () => 'foo', { limit: 0, attempts: 0 })
        expect(result).toEqual('foo')
    })

    it('should pass when optional arguments are passed', async () => {
        const result = await executeAsync.call({}, async (arg: unknown) => arg, { limit: 1, attempts: 0 }, ['foo'])
        expect(result).toEqual('foo')
    })

    it('should reject if fn throws error directly', async () => {
        let error
        const fn = () => { throw new Error('foo') }
        try {
            await executeAsync.call({}, fn, { limit: 0, attempts: 0 })
        } catch (err: any) {
            error = err
        }
        expect(error.message).toEqual('foo')
    })

    it('should repeat if fn throws error directly and repeatTest provided', async () => {
        let counter = 3
        const scope = { wdioRetries: undefined }
        const repeatTest = { limit: counter, attempts: 0 }
        const result = await executeAsync.call(scope, () => {
            if (counter > 0) {
                counter--
                throw new Error('foo')
            }
            return Promise.resolve(true)
        }, repeatTest)
        expect(result).toEqual(true)
        expect(counter).toEqual(0)
        expect(repeatTest).toEqual({ limit: 3, attempts: 3 })
        expect(scope.wdioRetries).toEqual(3)
    })

    it('should repeat if fn rejects and repeatTest provided', async () => {
        let counter = 3
        const scope = { wdioRetries: undefined }
        const repeatTest = { limit: counter, attempts: 0 }
        const result = await executeAsync.call(scope, () => {
            if (counter > 0) {
                counter--
                return Promise.reject(new Error('foo'))
            }
            return Promise.resolve(true)
        }, repeatTest)
        expect(result).toEqual(true)
        expect(counter).toEqual(0)
        expect(repeatTest).toEqual({ limit: 3, attempts: 3 })
        expect(scope.wdioRetries).toEqual(3)
    })
})

describe('wrapCommand', () => {
    it('should not run a command hook in command hook', async () => {
        const rawCommand = vi.fn().mockReturnValue(Promise.resolve('Yayy!'))
        const commandA = wrapCommand('foobar', rawCommand)
        const commandB = wrapCommand('barfoo', rawCommand)
        const scope: any = {
            options: {
                beforeCommand: vi.fn(),
                afterCommand: vi.fn().mockImplementation(
                    () => commandB.call(scope, 123))
            }
        }

        expect(await commandA.call(scope, true, false, '!!')).toBe('Yayy!')
        expect(scope.options!.beforeCommand).toBeCalledTimes(1)
        expect(scope.options!.afterCommand).toBeCalledTimes(1)
        expect(rawCommand).toBeCalledTimes(2)
    })

    it('throws an error if command fails', async () => {
        const rawCommand = vi.fn().mockReturnValue(
            Promise.reject(new Error('Uppsi!')))
        const commandA = wrapCommand('foobar', rawCommand)
        const commandB = wrapCommand('barfoo', rawCommand)
        const scope: any = {
            options: {
                beforeCommand: vi.fn(),
                afterCommand: vi.fn().mockImplementation(
                    () => commandB.call(scope, 123))
            }
        }

        const error = await commandA.call(scope, true, false, '!!')
            .catch((err: Error) => err)
        expect((error as Error).message).toBe('Uppsi!')
        expect(scope.options!.beforeCommand).toBeCalledTimes(1)
        expect(scope.options!.afterCommand).toBeCalledTimes(1)
        expect(rawCommand).toBeCalledTimes(2)
    })

    it('allows to chain element promises', async () => {
        const rawCommand = vi.fn()
        const scope: any = {
            options: {
                beforeCommand: vi.fn(),
                afterCommand: vi.fn()
            },
            getTagName: vi.fn().mockResolvedValue('Yayy'),
            $: rawCommand
        }
        rawCommand.mockReturnValue(Promise.resolve(scope))
        const commandA = wrapCommand('$', rawCommand)
        expect(await commandA.call(scope, 'bar')
            .$('foo')
            .getTagName()
        ).toBe('Yayy')
        expect(scope.$).toBeCalledTimes(2)
        expect(scope.$).toBeCalledWith('bar')
        expect(scope.$).toBeCalledWith('foo')
        expect(scope.getTagName).toBeCalledTimes(1)
    })

    it('allows to chain element promises for custom command', async () => {
        const rawCommand = vi.fn()
        const scope: any = {
            options: {
                beforeCommand: vi.fn(),
                afterCommand: vi.fn()
            },
            getTagName: vi.fn().mockResolvedValue('Yayy'),
            user$: rawCommand
        }
        rawCommand.mockReturnValue(Promise.resolve(scope))
        const commandB = wrapCommand('user$', rawCommand)
        expect(await commandB.call(scope, 'bar')
            .user$('foo')
            .getTagName()).toBe('Yayy')
        expect(scope.user$).toBeCalledTimes(2)
        expect(scope.user$).toBeCalledWith('bar')
        expect(scope.user$).toBeCalledWith('foo')
        expect(scope.getTagName).toBeCalledTimes(1)
    })

    it('allows to access indexed element', async () => {
        const rawCommand$ = vi.fn()
        const rawCommand$$ = vi.fn()
        const scope: (i: number) => any = (i) => ({
            options: {
                beforeCommand: vi.fn(),
                afterCommand: vi.fn()
            },
            getTagName: vi.fn().mockResolvedValue('Yayy' + i),
            $: rawCommand$,
            $$: rawCommand$$
        })
        rawCommand$.mockResolvedValue(scope(0))
        rawCommand$$.mockReturnValue([
            Promise.resolve(scope(0)),
            Promise.resolve(scope(1)),
            Promise.resolve(scope(2))
        ])
        const commandA = wrapCommand('$', rawCommand$)
        expect(await commandA.call(scope(0))
            .$('foo')
            .$$('bar')[2]
            .getTagName()
        ).toBe('Yayy2')
        expect(await commandA.call(scope(0))
            .$('foo')
            .$$('bar')[2]
            .$('barfoo')
            .getTagName()
        ).toBe('Yayy0')
        expect(rawCommand$$).toBeCalledTimes(2)
        expect(rawCommand$$).toBeCalledWith('bar')
    })

    it('offers array methods on elements', async () => {
        const rawCommand$ = vi.fn()
        const rawCommand$$ = vi.fn()
        const scope: (i: number) => any = (i) => ({
            options: {
                beforeCommand: vi.fn(),
                afterCommand: vi.fn()
            },
            getTagName: vi.fn().mockResolvedValue('Yayy' + i),
            $: rawCommand$,
            $$: rawCommand$$
        })
        rawCommand$.mockResolvedValue(scope(0))
        rawCommand$$.mockReturnValue([
            Promise.resolve(scope(0)),
            Promise.resolve(scope(1)),
            Promise.resolve(scope(2))
        ])
        const commandA = wrapCommand('$', rawCommand$)
        expect(await commandA.call(scope(0))
            .$('foo')
            .$$('bar')
            .map((el: any) => el.getTagName())
        ).toEqual(['Yayy0', 'Yayy1', 'Yayy2'])
    })

    it('can access element properties', async () => {
        const scope: any = {
            options: {
                beforeCommand: vi.fn(),
                afterCommand: vi.fn()
            },
            selector: 'foobar'
        }
        const rawCommand = vi.fn().mockReturnValue(Promise.resolve(scope))
        const commandA = wrapCommand('$', rawCommand)
        expect(await commandA.call(scope).selector).toBe('foobar')
    })

    it('can iterate over elements asynchronously', async () => {
        const options = {
            beforeCommand: vi.fn(),
            afterCommand: vi.fn()
        }
        const scope: any = [{
            selector: 'foobarA',
            options
        }, {
            selector: 'foobarB',
            options
        }, {
            selector: 'foobarC',
            options
        }]
        scope.options = options
        const rawCommand = vi.fn().mockReturnValue(Promise.resolve(scope))
        const commandA = wrapCommand('$$', rawCommand).bind(scope) as unknown as (sel: string) => Promise<any>[]

        const expectedResults = ['foobarA', 'foobarB', 'foobarC']
        let i = 0
        for await (const elem of commandA('selector')) {
            expect(expectedResults[i++]).toBe(elem.selector)
        }
    })

    it('throws an error if iterating through a non array', async () => {
        expect.assertions(1)
        const options = {
            beforeCommand: vi.fn(),
            afterCommand: vi.fn()
        }
        const scope: any = {
            selector: 'foobarA',
            options
        }
        scope.options = options
        const rawCommand = vi.fn().mockReturnValue(Promise.resolve(scope))
        const commandA = wrapCommand('$', rawCommand).bind(scope) as unknown as (sel: string) => Promise<any>[]

        try {
            for await (const elem of commandA('selector')) {
                console.log(elem)
            }
        } catch (err: any) {
            expect(err.message).toBe('Can not iterate over non array')
        }
    })
})
