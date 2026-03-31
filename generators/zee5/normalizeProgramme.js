/**
 * Normalize a single Zee5 programme item into a rich internal model
 */
export function normalizeProgramme(raw, channel) {
  const start = new Date(raw.start_time || raw.start || raw.from)
  const stop = new Date(raw.end_time || raw.end || raw.to)

  const duration =
    raw.duration
      ? raw.duration * 60
      : Math.max(0, (stop - start) / 1000)

  return {
    channelId: channel.id,

    schedule: {
      start,
      stop,
      duration,
      timezone: '+0530',
      isLive: raw.is_live || false,
      isRepeat: raw.is_repeat || false,
    },

    identity: {
      programmeId: raw.id || null,
      seriesId: raw.series_id || raw.show_id || null,
      episodeId: raw.episode_id || null,
      season: raw.season_number || null,
      episode: raw.episode_number || null,
    },

    titles: {
      main: raw.title || raw.name || '',
      episode: raw.episode_title || null,
      original: raw.original_title || raw.title || '',
    },

    description: {
      short: raw.short_description || '',
      long: raw.description || raw.long_description || '',
    },

    genres: [
      ...(raw.genres || []).map(g => g.value || g),
      ...(raw.tags || []),
    ].filter(Boolean),

    categories: (raw.genres || []).map(g => g.value).filter(Boolean),

    language: raw.language || (raw.languages || [])[0] || null,

    people: {
      actors: raw.cast || [],
      directors: raw.directors || [],
    },

    media: {
      poster: raw.image?.list || raw.image?.cover || null,
      thumbnail: raw.image?.thumbnail || null,
    },

    rating: {
      system: raw.rating_system || null,
      value: raw.rating || null,
    },

    production: {
      year: raw.release_year || null,
      studio: raw.production_house || null,
    },

    raw, // ✅ KEEP RAW OBJECT (VERY IMPORTANT)
  }
}
