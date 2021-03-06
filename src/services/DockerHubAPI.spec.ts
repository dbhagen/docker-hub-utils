import { DateTime } from 'luxon'
import R from 'ramda'
import axios from 'axios'

import { DockerHubRepo } from '../types/DockerHubRepo'
import {
  extractRepositoryDetails,
  fetchManifestList,
  queryRepo,
  queryTags,
  queryTopRepos,
} from './DockerHubAPI'
import fixture from '../__tests__/repos_fixture.json'
import log from '../utils/log'
import manifestFixture from '../__tests__/manifest_fixture.json'
import repoFixturesInvalid from '../__tests__/repos_fixtures_invalid.json'
import tagsFixture from '../__tests__/tags_fixture.json'

const get = jest.spyOn(axios, 'get').mockResolvedValue({})
const request = jest.spyOn(axios, 'request')
const logInfo = jest.spyOn(log, 'info')

const repoFixtures = fixture.data.results

describe('DockerHub handler', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('extractRepositoryDetails for a non-existent repo', () => {
    const repositoryDetails = extractRepositoryDetails([])
    expect(repositoryDetails).toHaveLength(0)
  })

  test('extractRepositoryDetails happy path', () => {
    const repoResults = repoFixtures
    const repositoryDetails = extractRepositoryDetails(repoResults)
    expect(repositoryDetails).toHaveLength(R.length(repoResults))
    const keys = [
      'description',
      'lastUpdated',
      'name',
      'pullCount',
      'starCount',
    ]

    // Verify values are defined for each of the above keys.
    repositoryDetails.forEach(repo => {
      keys.forEach((key: string) => {
        expect(repo).toHaveProperty(key)
      })
    })
  })

  test('queryTopRepos', async () => {
    // Configure axios to return our fixtures, rather than hitting the API.
    get.mockResolvedValueOnce(fixture)

    const topRepos: DockerHubRepo[] = await queryTopRepos({
      numRepos: 25,
      user: 'jessestuart',
    })

    // Only one HTTP call required -- no auth needed when querying repos.
    expect(get).toHaveBeenCalledTimes(1)
    expect(topRepos).toHaveLength(R.length(repoFixtures))

    const totalPulls = R.sum(R.pluck('pullCount', topRepos))
    expect(totalPulls).toMatchSnapshot()

    const topRepoName = R.pipe(R.head, R.path(['name']))(topRepos)

    expect(topRepoName).toBe('owntracks')
  })

  test('queryTopRepos, limit results by date', async () => {
    get.mockResolvedValueOnce(fixture)

    const topRepos: DockerHubRepo[] = await queryTopRepos({
      lastUpdatedSince: DateTime.fromISO('2019-06-05'),
      numRepos: 25,
      user: 'jessestuart',
    })

    expect(get).toHaveBeenCalledTimes(1)
    expect(topRepos).toMatchSnapshot()
    expect(topRepos.length).toBeLessThan(repoFixtures.length)
  })

  test('queryTopRepos with invalid data (lastUpdated undefined)', async () => {
    get.mockResolvedValueOnce(repoFixturesInvalid)

    const topRepos: DockerHubRepo[] = await queryTopRepos({
      lastUpdatedSince: DateTime.fromISO('2019-06-05'),
      numRepos: 25,
      user: 'jessestuart',
    })

    expect(get).toHaveBeenCalledTimes(1)
    expect(topRepos).toMatchSnapshot()
    expect(topRepos.length).toBe(0)
  })

  test('queryTopRepos with no numRepos specified', async () => {
    get.mockResolvedValueOnce(fixture)

    const topRepos: DockerHubRepo[] = await queryTopRepos({
      lastUpdatedSince: DateTime.fromISO('2019-06-05'),
      user: 'jessestuart',
    })

    expect(get).toHaveBeenCalledTimes(1)
    expect(topRepos).toMatchSnapshot()
  })

  test('queryTopRepos fails if >100 repos requested.', () => {
    get.mockResolvedValueOnce(fixture)

    const topReposRequest = queryTopRepos({
      numRepos: 101,
      user: 'jessestuart',
    })
    expect(topReposRequest).rejects.toThrow()

    expect(get).toHaveBeenCalledTimes(0)
  })

  test('queryRepo (limit results by name)', async () => {
    request.mockResolvedValueOnce({
      data: R.head(fixture.data.results.filter((r: any) => r.name === 'minio')),
      status: 200,
    })

    const repo: DockerHubRepo | undefined = await queryRepo({
      name: 'minio',
      user: 'jessestuart',
    })
    expect(repo).not.toBeUndefined()
    expect(request).toHaveBeenCalledTimes(1)
    // eslint-disable-next-line
    expect(repo!.name).toBe('minio')
    expect(repo).toMatchSnapshot()
  })

  test('queryRepo for non-existent repo', async () => {
    request.mockResolvedValueOnce({
      data: { detail: 'Object not found' },
      status: 404,
    })

    const repo = await queryRepo({
      name: 'not-a-repo-nope',
      user: 'jessestuart',
    })
    expect(repo).toBeUndefined()
  })

  test('fetchManifestList happy path.', async () => {
    get.mockResolvedValueOnce({ data: { token: 'FAKE_TOKEN' } })
    get.mockResolvedValueOnce(manifestFixture)

    const topRepo: DockerHubRepo | undefined = R.head(
      extractRepositoryDetails(repoFixtures),
    )
    if (!topRepo) {
      fail('Unable to load repos fixture.')
      return
    }

    const manifestList = await fetchManifestList(topRepo)
    expect(get).toHaveBeenCalledTimes(2)
    expect(get.mock.calls).toMatchSnapshot()
    expect(get).toHaveBeenNthCalledWith(1, 'https://auth.docker.io/token', {
      params: {
        scope: 'repository:jessestuart/owntracks:pull',
        service: 'registry.docker.io',
      },
    })
    expect(get).toHaveBeenNthCalledWith(
      2,
      'https://registry-1.docker.io/v2/jessestuart/owntracks/manifests/latest',
      {
        headers: {
          Accept: 'application/vnd.docker.distribution.manifest.list.v2+json',
          Authorization: 'Bearer FAKE_TOKEN',
        },
      },
    )

    expect(manifestList).toMatchSnapshot()
  })

  // eslint-disable-next-line
  test('fetchManifestList returns early for schemaVersion 1.', async () => {
    get.mockResolvedValueOnce({ data: { token: 'FAKE_TOKEN' } })
    get.mockResolvedValueOnce({ data: { schemaVersion: 1 } })

    const topRepo: DockerHubRepo | undefined = R.head(
      extractRepositoryDetails(repoFixtures),
    )
    if (!topRepo) {
      fail('Top repo is undefined.')
      return
    }

    const manifestList = await fetchManifestList(topRepo)
    expect(manifestList).toBeUndefined()
    expect(logInfo).toHaveBeenCalledTimes(1)
  })

  // eslint-disable-next-line
  test('fetchManifestList fails when no token returned.', async () => {
    get.mockResolvedValueOnce({ data: {} })
    get.mockResolvedValueOnce(manifestFixture)

    const topRepo = R.head(extractRepositoryDetails(repoFixtures))
    if (!topRepo) {
      fail('Unable to load repos fixture.')
      return
    }

    expect(fetchManifestList(topRepo)).rejects.toThrow()
    expect(get).toHaveBeenCalledTimes(1)
  })

  test('queryTags happy path.', async () => {
    get.mockResolvedValueOnce(tagsFixture)
    const repos = R.path(['data', 'results'], fixture)
    // @ts-ignore
    const repo: DockerHubRepo = R.find(R.propEq('name', 'minio'))(repos)
    const tags = await queryTags(repo)
    expect(tags).toMatchSnapshot()
  })

  test('queryTags (null result).', async () => {
    get.mockResolvedValueOnce([])
    const repos = R.path(['data', 'results'], fixture)
    // @ts-ignore
    const repo: DockerHubRepo = R.find(R.propEq('name', 'minio'))(repos)
    const tags = await queryTags(repo)
    expect(tags).toBeUndefined()
  })
})
