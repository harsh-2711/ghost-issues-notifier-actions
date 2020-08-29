import { getOctokit } from '@actions/github'

export interface Config {
  cutoff: string
  label: string
  message: string
  search: string
}

export interface IssuesInfo {
  id: string
  permalink: string
}

export interface InfoQueryResult {
  repo: {
    label: {
      id: string
    }
  }
  stuckIssues: {
    totalCount: number
    issues: IssuesInfo[]
  }
  prevStuckIssues: {
    totalCount: number
    issues: IssuesInfo[]
  }
}

export interface Context {
  client: ReturnType<typeof getOctokit>
  config: Config
  labelId: string
}