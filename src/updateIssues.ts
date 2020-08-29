import { debug } from '@actions/core'

import { Context, InfoQueryResult } from './types'

export const updateIssues = async (
  context: Context,
  data: InfoQueryResult
): Promise<void> => {
  const { client, config, labelId } = context
  const { stuckIssues, prevStuckIssues } = data

  debug('Generating UpdateIssues mutation')

  const mutations = [
    ...stuckIssues.issues.map((issue, i) => {
      const labelArgs = `input: { labelableId:"${issue.id}", labelIds: $labelIds }`
      const commentArgs = `input: { subjectId: "${issue.id}", body: $commentBody }`

      return `
        issuePr_${i}: addLabelsToLabelable(${labelArgs}) {
          labelable {
            __typename
          }
        }
        addComment_${i}: addComment(${commentArgs}) {
          subject {
            id
          }
        }
      `
    }),
    ...prevStuckIssues.issues.map((issue, i) => {
      const nodeArgs = `input:{labelableId:"${issue.id}", labelIds: $labelIds}`
      return `
        removeLabelIssue_${i}: removeLabelsFromLabelable(${nodeArgs}) {
          labelable {
            __typename
          }
        }
      `
    })
  ]

  const queryVarsDef: { [key: string]: [string, unknown] } = {
    labelIds: ['[String!]!', [labelId]]
  }

  if (stuckIssues.issues.length > 0) {
    queryVarsDef.commentBody = ['String!', config.message]
  }

  const queryArgsStr = Object.entries(queryVarsDef)
    .map(([key, value]) => `$${key}: ${value[0]}`)
    .join(', ')

  // @ts-ignore Object.fromEntries is too new for TS right now
  const queryVars = Object.fromEntries(
    Object.entries(queryVarsDef).map(([key, value]) => [key, value[1]])
  )

  const query = `mutation UpdateIssues (${queryArgsStr}) {\n${mutations.join(
    '\n'
  )}\n}`
  debug(`Sending UpdateIssues mutation request:\n${query}`)
  debug(`Mutation query vars: ${JSON.stringify(queryVars)}`)
  debug('UpdateIssues mutation sent')

  await client.graphql(query, queryVars)
}