# Weekly Refactoring Report

**Week of:** {{ weekStartDate }} - {{ weekEndDate }}  
**Generated:** {{ generatedDate }}  
**Reporter:** {{ reporter }}

## =Ê Executive Summary

### Overall Progress
- **Refactoring Velocity:** {{ velocity }} story points
- **Completion Rate:** {{ completionRate }}%
- **Quality Score:** {{ qualityScore }}/10
- **Team Satisfaction:** {{ teamSatisfaction }}/5 P

### Key Achievements
{{ #keyAchievements }}
- {{ achievement }}
{{ /keyAchievements }}

### Critical Issues
{{ #criticalIssues }}
-   **{{ title }}**: {{ description }}
{{ /criticalIssues }}

## <¯ Weekly Objectives Review

### Planned vs. Actual
| Objective | Planned | Actual | Status |
|-----------|---------|--------|--------|
{{ #objectives }}
| {{ name }} | {{ planned }} | {{ actual }} | {{ status }} |
{{ /objectives }}

### Completed Tasks
{{ #completedTasks }}
-  **{{ name }}**
  - Type: {{ type }}
  - Effort: {{ effort }}h
  - Impact: {{ impact }}
  - Assignee: {{ assignee }}
{{ /completedTasks }}

### Ongoing Tasks
{{ #ongoingTasks }}
- = **{{ name }}**
  - Progress: {{ progress }}%
  - Blocked: {{ blocked ? "Yes" : "No" }}
  - Expected completion: {{ expectedCompletion }}
  - Assignee: {{ assignee }}
{{ /ongoingTasks }}

### Deferred Tasks
{{ #deferredTasks }}
- ø **{{ name }}**
  - Reason: {{ reason }}
  - New target: {{ newTarget }}
  - Assignee: {{ assignee }}
{{ /deferredTasks }}

## =È Metrics Dashboard

### Code Quality Trends
| Metric | Previous Week | This Week | Change | Trend |
|--------|---------------|-----------|--------|-------|
| Duplicate Code | {{ duplicates.previous }}% | {{ duplicates.current }}% | {{ duplicates.change }}% | {{ duplicates.trend }} |
| Technical Debt | {{ techDebt.previous }}h | {{ techDebt.current }}h | {{ techDebt.change }}h | {{ techDebt.trend }} |
| Code Coverage | {{ coverage.previous }}% | {{ coverage.current }}% | {{ coverage.change }}% | {{ coverage.trend }} |
| Cyclomatic Complexity | {{ complexity.previous }} | {{ complexity.current }} | {{ complexity.change }} | {{ complexity.trend }} |
| Build Time | {{ buildTime.previous }}min | {{ buildTime.current }}min | {{ buildTime.change }}min | {{ buildTime.trend }} |

### Consolidation Progress
- **Total Duplicates Identified:** {{ totalDuplicates }}
- **Duplicates Resolved:** {{ resolvedDuplicates }}
- **Resolution Rate:** {{ resolutionRate }}%
- **Files Consolidated:** {{ filesConsolidated }}
- **Lines of Code Reduced:** {{ locReduced }}

### Team Productivity
- **Commits:** {{ commits }}
- **PRs Opened:** {{ prsOpened }}
- **PRs Merged:** {{ prsMerged }}
- **Code Reviews:** {{ codeReviews }}
- **Refactoring Hours:** {{ refactoringHours }}

## =' Technical Highlights

### Major Refactorings Completed
{{ #majorRefactorings }}
- **{{ name }}**
  - **Description:** {{ description }}
  - **Impact:** {{ impact }}
  - **Files affected:** {{ filesAffected }}
  - **Lines changed:** {{ linesChanged }}
  - **Performance improvement:** {{ performanceImprovement }}
  - **Assignee:** {{ assignee }}
{{ /majorRefactorings }}

### Pattern Standardizations
{{ #patternStandardizations }}
- **{{ pattern }}**
  - **Occurrences fixed:** {{ occurrencesFixed }}
  - **Consistency improvement:** {{ consistencyImprovement }}%
  - **Files updated:** {{ filesUpdated }}
{{ /patternStandardizations }}

### Dependency Updates
{{ #dependencyUpdates }}
- **{{ name }}**: {{ oldVersion }} ’ {{ newVersion }}
  - **Type:** {{ type }}
  - **Breaking changes:** {{ breakingChanges ? "Yes" : "No" }}
  - **Migration effort:** {{ migrationEffort }}h
{{ /dependencyUpdates }}

## =¨ Issues and Blockers

### Active Blockers
{{ #activeBlockers }}
- **{{ title }}**
  - **Severity:** {{ severity }}
  - **Description:** {{ description }}
  - **Owner:** {{ owner }}
  - **ETA for resolution:** {{ eta }}
  - **Workaround:** {{ workaround }}
{{ /activeBlockers }}

### Resolved Issues
{{ #resolvedIssues }}
- **{{ title }}**
  - **Resolution:** {{ resolution }}
  - **Time to resolve:** {{ timeToResolve }}
  - **Resolved by:** {{ resolvedBy }}
{{ /resolvedIssues }}

### Risk Assessment
{{ #risks }}
- **{{ title }}** ({{ probability }} probability, {{ impact }} impact)
  - **Description:** {{ description }}
  - **Mitigation:** {{ mitigation }}
  - **Owner:** {{ owner }}
{{ /risks }}

## =e Team Updates

### Team Capacity
- **Available hours:** {{ availableHours }}h
- **Refactoring hours:** {{ refactoringHours }}h
- **Utilization:** {{ utilization }}%

### Individual Contributions
{{ #teamMembers }}
- **{{ name }}**
  - **Tasks completed:** {{ tasksCompleted }}
  - **Hours logged:** {{ hoursLogged }}h
  - **Specialization:** {{ specialization }}
  - **Highlights:** {{ highlights }}
  - **Blockers:** {{ blockers }}
{{ /teamMembers }}

### Training and Development
{{ #training }}
- **{{ topic }}**
  - **Attendees:** {{ attendees }}
  - **Duration:** {{ duration }}h
  - **Effectiveness rating:** {{ effectiveness }}/5
{{ /training }}

## = Code Review Insights

### Review Statistics
- **PRs reviewed:** {{ prsReviewed }}
- **Average review time:** {{ avgReviewTime }}h
- **Review quality score:** {{ reviewQualityScore }}/10

### Common Feedback Themes
{{ #feedbackThemes }}
- **{{ theme }}**: {{ frequency }} occurrences
  - **Action items:** {{ actionItems }}
{{ /feedbackThemes }}

### Best Practices Identified
{{ #bestPractices }}
- {{ practice }}
{{ /bestPractices }}

## = Continuous Improvement

### Process Improvements Implemented
{{ #processImprovements }}
- **{{ improvement }}**
  - **Impact:** {{ impact }}
  - **Adoption rate:** {{ adoptionRate }}%
{{ /processImprovements }}

### Tool Updates
{{ #toolUpdates }}
- **{{ tool }}**: {{ update }}
  - **Benefit:** {{ benefit }}
  - **Training required:** {{ trainingRequired ? "Yes" : "No" }}
{{ /toolUpdates }}

### Automation Wins
{{ #automationWins }}
- **{{ automation }}**
  - **Time saved:** {{ timeSaved }}h/week
  - **Error reduction:** {{ errorReduction }}%
{{ /automationWins }}

## =Å Next Week's Plan

### Primary Objectives
{{ #nextWeekObjectives }}
1. **{{ objective }}**
   - **Priority:** {{ priority }}
   - **Estimated effort:** {{ estimatedEffort }}h
   - **Assignee:** {{ assignee }}
   - **Dependencies:** {{ dependencies }}
{{ /nextWeekObjectives }}

### Resource Allocation
- **Available capacity:** {{ nextWeekCapacity }}h
- **Planned work:** {{ plannedWork }}h
- **Buffer:** {{ buffer }}%

### Risks and Mitigation
{{ #nextWeekRisks }}
- **{{ risk }}**
  - **Probability:** {{ probability }}
  - **Impact:** {{ impact }}
  - **Mitigation plan:** {{ mitigationPlan }}
{{ /nextWeekRisks }}

## =Ú Knowledge Sharing

### Documentation Updates
{{ #documentationUpdates }}
- **{{ document }}**: {{ update }}
  - **Type:** {{ type }}
  - **Author:** {{ author }}
{{ /documentationUpdates }}

### Lessons Learned
{{ #lessonsLearned }}
- **{{ lesson }}**
  - **Context:** {{ context }}
  - **Impact:** {{ impact }}
  - **Recommendation:** {{ recommendation }}
{{ /lessonsLearned }}

### Team Feedback
{{ #teamFeedback }}
- **{{ category }}**: {{ feedback }}
  - **Sentiment:** {{ sentiment }}
  - **Action needed:** {{ actionNeeded ? "Yes" : "No" }}
{{ /teamFeedback }}

## <– Recognition

### Outstanding Contributions
{{ #outstandingContributions }}
- **{{ contributor }}**: {{ contribution }}
  - **Impact:** {{ impact }}
{{ /outstandingContributions }}

### Milestone Achievements
{{ #milestones }}
- <‰ **{{ milestone }}**
  - **Date achieved:** {{ dateAchieved }}
  - **Team impact:** {{ teamImpact }}
{{ /milestones }}

## =Ê Appendix

### Detailed Metrics
- **Build success rate:** {{ buildSuccessRate }}%
- **Test failure rate:** {{ testFailureRate }}%
- **Deploy frequency:** {{ deployFrequency }}
- **Mean time to recovery:** {{ mttr }}h

### Links to Detailed Reports
- [Detailed Analysis Report]({{ detailedReportLink }})
- [Performance Benchmarks]({{ performanceReportLink }})
- [Code Quality Dashboard]({{ qualityDashboardLink }})
- [Team Velocity Chart]({{ velocityChartLink }})

---

**Next report due:** {{ nextReportDate }}  
**Contact for questions:** {{ contactInfo }}  
**Report version:** {{ reportVersion }}

### Action Items for Next Week
{{ #actionItems }}
- [ ] {{ item }}
  - **Owner:** {{ owner }}
  - **Due:** {{ dueDate }}
  - **Priority:** {{ priority }}
{{ /actionItems }}