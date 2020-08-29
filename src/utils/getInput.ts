import * as core from '@actions/core'

export function getInput(key: string, options: { required: true }): string

export function getInput(
  key: string,
  options?: core.InputOptions
): string | undefined

export function getInput(
  key: string,
  options?: core.InputOptions
): string | undefined {
  const value = core.getInput(key, options)
  return value !== '' ? value : undefined
}