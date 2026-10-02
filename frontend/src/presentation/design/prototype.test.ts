import { describe, expect, it } from 'vitest'
import { runPrototypeAction } from './prototype'
import type { PrototypeAction } from './types'

describe('exported prototype interactions', () => {
  it('executes variable updates before conditional navigation and preserves action order', () => {
    const variables = new Map<string, unknown>(),
      navigations: string[] = []
    const action: PrototypeAction = {
      type: 'SEQUENCE',
      actions: [
        { type: 'SET_VARIABLE', variableId: 'loaded', variableValue: { type: 'FLOAT', value: 14 } },
        {
          type: 'CONDITIONAL',
          conditionalBlocks: [
            {
              condition: {
                type: 'EXPRESSION',
                value: {
                  expressionFunction: 'EQUALS',
                  expressionArguments: [
                    { type: 'VARIABLE_ALIAS', value: { id: 'loaded' } },
                    { type: 'FLOAT', value: 14 },
                  ],
                },
              },
              actions: [{ type: 'NODE', destinationId: 'rear-loaded' }],
            },
            { actions: [{ type: 'NODE', destinationId: 'start' }] },
          ],
        },
      ],
    }
    runPrototypeAction(action, (action) => navigations.push(action.destinationId!), variables)
    expect(navigations).toEqual(['rear-loaded'])
    expect(variables.get('loaded')).toBe(14)
  })
  it('evaluates nested guards and takes the fallback only when no condition matches', () => {
    const navigation: string[] = []
    runPrototypeAction(
      {
        type: 'CONDITIONAL',
        conditionalBlocks: [
          {
            condition: {
              type: 'EXPRESSION',
              value: {
                expressionFunction: 'AND',
                expressionArguments: [
                  { type: 'BOOLEAN', value: true },
                  {
                    type: 'EXPRESSION',
                    value: {
                      expressionFunction: 'NOT',
                      expressionArguments: [{ type: 'BOOLEAN', value: true }],
                    },
                  },
                ],
              },
            },
            actions: [{ type: 'NODE', destinationId: 'blocked' }],
          },
          { actions: [{ type: 'NODE', destinationId: 'fallback' }] },
        ],
      },
      (action) => navigation.push(action.destinationId!),
      new Map(),
    )
    expect(navigation).toEqual(['fallback'])
  })
})
