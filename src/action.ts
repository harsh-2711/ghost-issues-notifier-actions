import * as core from '@actions/core'
import { getOctokit } from '@actions/github'
import ms from 'ms'

import { Config, Context, InfoQueryResult } from './types'
import { updateIssues } from './updateIssues'
import { getInput } from './utils/getInput'

const { debug } = core

const { GITHUB_REPOSITORY } = process.env as { GITHUB_REPOSITORY: string }

const timeNum = (num: number) => num.toString().padStart(2, '0')

const generateCutoffDateString = (cutoff: number): string => {
  const d = new Date(Date.now() - cutoff)
  const year = d.getUTCFullYear()
  const month = timeNum(d.getUTCMonth() + 1)
  const day = timeNum(d.getUTCDate())
  const hours = timeNum(d.getUTCHours())
  const mins = timeNum(d.getUTCMinutes())

  return `${year}-${month}-${day}T${hours}:${mins}:00+00:00`
}

const escapeStr = (str: string): string => JSON.stringify(str).slice(1, -1)

const run = async () => {
  try {
    const client = getOctokit(getInput('repo-token', { required: true }))
    const [repoOwner, repoName] = GITHUB_REPOSITORY.split('/')
    const config: Config = {
      cutoff: getInput('cutoff') || '24h',
      label: getInput('label') || 'stuck',
      message: getInput('message', { required: true }),
      search: getInput('search-params') || getInput('search-query', { required: true })
    }

    const stuckLabel = config.label
    const stuckCutoff = ms(config.cutoff)
    const stuckSearch = config['search']
    const createdSince = generateCutoffDateString(stuckCutoff)

    const queryVarArgs: string = Object.entries({
      repoOwner: 'String!',
      repoName: 'String!',
      stuckLabel: 'String!',
      stuckIssuesQuery: 'String!',
      prevStuckIssuesQuery: 'String!'
    })
      .map(([key, value]) => `$${key}: ${value}`)
      .join(', ')

    const prNodeArgs = 'type: ISSUE, first: 100'

    const query = `
      query GetGhostIssues(${queryVarArgs}) {
        repo: repository(owner: $repoOwner, name: $repoName) {
          label(name: $stuckLabel) {
            id
          }
        }
        stuckIssues: search(query: $stuckIssuesQuery, ${prNodeArgs}) {
          totalCount: issueCount
          issues: nodes {
            ... on Issue {
              id
              permalink
            }
          }
        }
        prevStuckIssues: search(query: $prevStuckIssuesQuery, ${prNodeArgs}) {
          totalCount: issueCount
          issues: nodes {
            ... on Issue {
              id
              permalink
            }
          }
        }
      }
    `

    const stuckIssuesQuery = `repo:${escapeStr(GITHUB_REPOSITORY)} is:issue ${escapeStr(
      stuckSearch
    )} is:open created:<=${createdSince} -label:${JSON.stringify(stuckLabel)}`

    const prevStuckIssuesQuery = `repo:${escapeStr(GITHUB_REPOSITORY)} is:issue is:closed label:${JSON.stringify(stuckLabel)}`

    debug(`Using stuck PRs search query:\n${stuckIssuesQuery}`)
    debug(`Using previously stuck PRs search query:\n${prevStuckIssuesQuery}`)

    const data: InfoQueryResult = await client.graphql(query, {
      repoOwner,
      repoName,
      stuckLabel,
      stuckIssuesQuery,
      prevStuckIssuesQuery
    })

    if (data.stuckIssues.totalCount === 0 && data.prevStuckIssues.totalCount === 0) {
      debug('No ghost issues found.')
      return
    }

    {
      const total = data.stuckIssues.totalCount
      debug(`Found ${total.toLocaleString('en')} currently stuck ${total === 1 ? 'PR' : 'PRs'}.`)
    }
    {
      const total = data.prevStuckIssues.totalCount
      debug(`Found ${total.toLocaleString('en')} previously stuck ${total === 1 ? 'PR' : 'PRs'}.`)
    }

    const context: Context = {
      client,
      config,
      labelId: data.repo.label.id
    }

    await updateIssues(context, data)
  } catch (err) {
    core.setFailed(err)
  }
}

run()