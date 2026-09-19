import { useEffect } from 'react'
import { fetchChaoxingLessons, pingChaoxing } from './bridge'
import { useSchedule } from './context'
import { isEmbed, isInIframe } from './embed'

export function ChaoxingBootstrap() {
  const { replaceCourses, setWeek } = useSchedule()

  useEffect(() => {
    if (!isEmbed() || !isInIframe()) return
    void (async () => {
      const ok = await pingChaoxing()
      if (!ok) return
      const result = await fetchChaoxingLessons()
      replaceCourses(result.courses)
      if (result.curriculum?.currentWeek) setWeek(result.curriculum.currentWeek)
    })()
  }, [replaceCourses, setWeek])

  return null
}
