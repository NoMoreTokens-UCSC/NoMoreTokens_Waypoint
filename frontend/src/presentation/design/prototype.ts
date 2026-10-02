import type { PrototypeAction } from './types'

export interface PrototypeValue {
  type?: string
  resolvedType?: string
  value?: unknown
  expressionFunction?: string
  expressionArguments?: PrototypeValue[]
  id?: string
}
export type PrototypeVariables = Map<string, unknown>
const sessionVariables: PrototypeVariables = new Map()

function evaluate(input: PrototypeValue | undefined, variables: PrototypeVariables): unknown {
  if (!input) return undefined
  if (input.type === 'VARIABLE_ALIAS') {
    const alias = typeof input.value === 'object' ? (input.value as PrototypeValue) : input
    return (
      variables.get(alias.id ?? '') ??
      (input.resolvedType === 'STRING' ? '' : input.resolvedType === 'BOOLEAN' ? false : 0)
    )
  }
  const expression =
    typeof input.value === 'object' && input.value ? (input.value as PrototypeValue) : input
  if (expression.expressionFunction) {
    const args =
      expression.expressionArguments?.map((argument) => evaluate(argument, variables)) ?? []
    switch (expression.expressionFunction) {
      case 'EQUALS':
        return args[0] === args[1]
      case 'NOT_EQUAL':
        return args[0] !== args[1]
      case 'NOT':
        return !args[0]
      case 'AND':
        return args.every(Boolean)
      case 'OR':
        return args.some(Boolean)
      case 'GREATER_THAN':
        return Number(args[0]) > Number(args[1])
      case 'GREATER_THAN_OR_EQUAL':
        return Number(args[0]) >= Number(args[1])
      case 'LESS_THAN':
        return Number(args[0]) < Number(args[1])
      case 'LESS_THAN_OR_EQUAL':
        return Number(args[0]) <= Number(args[1])
      case 'ADDITION':
        return Number(args[0]) + Number(args[1])
      case 'SUBTRACTION':
        return Number(args[0]) - Number(args[1])
      default:
        return undefined
    }
  }
  return input.value
}

/** Interpret exported actions as data; never execute scripts from a design file. */
export function runPrototypeAction(
  action: PrototypeAction,
  navigate: (action: PrototypeAction) => void,
  variables = sessionVariables,
  depth = 0,
) {
  if (depth > 32) throw new Error('Prototype action nesting is too deep.')
  if (action.type === 'SEQUENCE') {
    action.actions?.forEach((child) => runPrototypeAction(child, navigate, variables, depth + 1))
  } else if (action.type === 'SET_VARIABLE' && action.variableId) {
    variables.set(action.variableId, evaluate(action.variableValue, variables))
  } else if (action.type === 'CONDITIONAL') {
    const block = action.conditionalBlocks?.find(
      (block) => !block.condition || evaluate(block.condition, variables),
    )
    block?.actions.forEach((child) => runPrototypeAction(child, navigate, variables, depth + 1))
  } else navigate(action)
}

export function sourceActions(
  actions: { source: string; trigger?: { type: string }; action: PrototypeAction }[],
  id: string,
): PrototypeAction {
  return {
    type: 'SEQUENCE',
    actions: actions
      .filter((link) => link.source === id && link.trigger?.type === 'ON_CLICK')
      .map((link) => link.action),
  }
}
