import * as core from '@actions/core'
import * as github from '@actions/github'
import {parseInputs} from './inputs'
import {createRun, updateRun} from './checks'

import {wait} from './wait'

export const envVariableName = 'DFLYDEV_CHECK_RUN_COLLECTIONS'

async function run(): Promise<void> {
  try {
    core.debug(`Parsing inputs`)
    const inputs = parseInputs(core.getInput)

    core.debug(JSON.stringify(inputs))

    core.debug(`Setting up OctoKit`)
    const octokit = new github.GitHub(inputs.runContext.token)

    const ownership = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
    }
    const sha = github.context.sha

    for (const collectedCheckRun of inputs.runContext.collectedCheckRuns) {
      const collection = collectedCheckRun.collection
      const checkRun = collectedCheckRun.checkRun

      if (checkRun.gitHubCheckRunId) {
        core.debug(`Updating a Run (${checkRun.gitHubCheckRunId})`)

        updateRun(octokit, checkRun.gitHubCheckRunId, ownership, checkRun)
      } else {
        core.debug(`Create a Run`)

        const gitHubCheckRunId = await createRun(
          octokit,
          sha,
          ownership,
          checkRun,
        )

        const foundCollectedCheckRun = inputs.globalContext.collections.find(
          thisCollectedCheckRun =>
            thisCollectedCheckRun.collection === collection,
        )

        if (!foundCollectedCheckRun) {
          throw Error(`Could not find collection named '${collection}'`)
        }

        const foundCheckRun = foundCollectedCheckRun.checkRuns.find(
          thisCheckRun => thisCheckRun.id === checkRun.id,
        )

        if (!foundCheckRun) {
          throw Error(
            `Could not find id '${checkRun.id}' in collection named '${collection}'`,
          )
        }

        foundCheckRun.gitHubCheckRunId = gitHubCheckRunId
      }
    }

    core.exportVariable(envVariableName, JSON.stringify(inputs.globalContext))

    if (inputs.runContext.fail) {
      core.setFailed(`Related step conclusion treated as a failure`)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
