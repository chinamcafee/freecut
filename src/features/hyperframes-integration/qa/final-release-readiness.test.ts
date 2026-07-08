import { describe, expect, it } from 'vite-plus/test'
import {
  CommunitySupportPlan,
  FinalReleaseGate,
  LegalNoticeChecker,
  ReleaseArtifactBuilder,
  ReleaseMaterialsPlanner,
} from './final-release-readiness'

describe('week 17 final release readiness', () => {
  it('requires final system validation, docs review, license review, and go/no-go acceptance', () => {
    const gate = new FinalReleaseGate().decide({
      e2ePassed: true,
      userJourneysPassed: true,
      crossPlatformPassed: true,
      edgeCasesPassed: true,
      docsComplete: true,
      apiDocsAccurate: true,
      examplesVerified: true,
      faqComplete: true,
      p0Remaining: 0,
      p1Remaining: 0,
      performancePassed: true,
      browserCompatibilityPassed: true,
    })

    expect(gate).toMatchObject({
      decision: 'go',
      releaseBlockingIssues: [],
      acceptedCriteria: [
        'FreeCut NLE preserved',
        'HyperFrames integration complete',
        '21 Skills covered',
        'AI assistant available',
        'recommendations available',
        'mixed render pipeline ready',
      ],
    })
  })

  it('checks open source license, dependency notice, LICENSE, and NOTICE readiness', () => {
    expect(
      new LegalNoticeChecker().check({
        projectLicense: 'MIT',
        dependencyLicensesReviewed: true,
        noticePrepared: true,
        licenseFilePrepared: true,
      }),
    ).toMatchObject({
      passed: true,
      files: ['LICENSE', 'NOTICE'],
    })
  })

  it('plans release notes, upgrade guide, demos, screenshots, technical blogs, and announcements', () => {
    expect(new ReleaseMaterialsPlanner().create()).toMatchObject({
      releaseNotes: true,
      knownLimitations: true,
      upgradeGuide: true,
      productVideo: true,
      featureDemo: true,
      screenshotsAndGifs: true,
      socialAnnouncements: ['Twitter/X', 'LinkedIn', 'Product Hunt'],
      technicalPosts: ['architecture', 'freecut-integration', 'ai-features', 'developer-guide'],
    })
  })

  it('prepares community, support, website, docs site, issue templates, PR template, and CI', () => {
    expect(new CommunitySupportPlan().create()).toMatchObject({
      readmeReady: true,
      issueTemplates: ['bug_report.yml', 'feature_request.yml'],
      prTemplate: true,
      githubActions: true,
      discord: { welcomeMessage: true, channels: ['announcements', 'help', 'showcase', 'bugs'] },
      supportDocs: ['troubleshooting', 'faq', 'response-templates', 'issue-triage'],
      docsSite: { deployed: true, ssl: true, linksChecked: true },
    })
  })

  it('builds release package metadata, checksums, install notes, channels, beta feedback, and post-release retro', () => {
    expect(
      new ReleaseArtifactBuilder().build({
        version: '1.0.0',
        artifacts: ['source', 'web-build', 'docker-image'],
      }),
    ).toMatchObject({
      version: '1.0.0',
      checksums: {
        source: expect.any(String),
        'web-build': expect.any(String),
        'docker-image': expect.any(String),
      },
      channels: ['GitHub Release', 'npm optional', 'Docker optional'],
      betaFeedbackClosed: true,
      rollbackPlan: true,
      retrospective: ['goals', 'lessons', 'team-growth', 'post-release-maintenance'],
    })
  })
})
