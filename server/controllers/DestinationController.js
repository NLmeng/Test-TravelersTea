/* eslint-disable node/no-unsupported-features/es-syntax */
const DestinationModel = require('../models/DestinationModel')
const getLatLon = require('../googleapi/getLatLon')
const generateDestination = require('../openai/generateDestination')
const nlp = require('compromise')

class DestinationController {
  async findClosestDestinations(latitude, longitude, n) {
    try {
      const milesToMeters = 1609.34 // Conversion factor
      const maxDistance = 30 * milesToMeters // Limit search to 30 miles

      const closestDestinations = await DestinationModel.find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: maxDistance,
          },
        },
      })
        .limit(n)
        .lean()

      return closestDestinations
    } catch (error) {
      error.message = 'Could not find closest destinations | ' + error.message
      throw error
    }
  }

  /**
   * Caches a stage's information into the database.
   * If the stage already exists, it updates the existing record.
   * Otherwise, it creates a new record.
   *
   * @param {Object} stage - The stage object containing stage datas.
   * @param {String} name - Whatever the user queried as 'destination'.
   * @param {String} notes - Extra notes.
   */
  async cacheStage(stage, name, notes) {
    try {
      const existingDestination = await DestinationModel.findOne({
        'location.coordinates': [stage.stageLongitude, stage.stageLatitude],
      }).lean()

      const tags = this.extractTags(notes)

      if (existingDestination) {
        await DestinationModel.findByIdAndUpdate(existingDestination._id, {
          $addToSet: {
            alias: stage.stageLocation,
            tag: { $each: tags },
          },
        })
      } else {
        const newDestination = {
          location: {
            coordinates: [stage.stageLongitude, stage.stageLatitude],
          },
          name: name,
          alias: [stage.stageLocation],
          description: stage.description,
          emoji: stage.emoji,
          tag: tags,
          rating: stage.stageRating,
        }

        await DestinationModel.create(newDestination)
      }
    } catch (error) {
      error.message = 'Could not cache stage | ' + error.message
      throw error
    }
  }

  // this could possibly be used to fetch from cache even when user has tripNote
  extractTags(notes) {
    const doc = nlp(notes)
    let nouns = doc.nouns().out('array')

    const stopWords = [
      'the',
      'and',
      'its',
      'its',
      'a',
      'an',
      'of',
      'to',
      'in',
      'for',
      'with',
      'on',
      'at',
      'by',
      'from',
    ]
    nouns = nouns.filter((word) => !stopWords.includes(word.toLowerCase()))

    return nouns
  }

  /**
   * Generates a trip itinerary by combining cached and newly generated stages.
   * It first tries to fetch up to 80% of the whole trip as cached stages based on the trip data.
   * Then, it generates the remaining stages while avoiding the cached locations.
   * Finally, it combines both sets of stages into a single itinerary.
   *
   * @param {Object} tripData - The trip constraints and details.
   * @returns {Object} - The combined itinerary with days and stages.
   */
  async generateTripWithCache(tripData) {
    const cacheDestination = await this.tryCache(tripData)
    const avoidLocations = []
    const destinationLeftToFetch = { ...tripData }

    if (cacheDestination) {
      cacheDestination.s.forEach((stage) => {
        avoidLocations.push(stage.l)
      })
      const cachedStagesCount = cacheDestination.s.length
      const cachedStagesPerDay = Math.floor(
        cachedStagesCount / tripData.numberOfDays,
      )
      destinationLeftToFetch.stagesPerDay =
        tripData.stagesPerDay - cachedStagesPerDay
    }

    let generatedDestination
    try {
      generatedDestination = await generateDestination(
        destinationLeftToFetch,
        avoidLocations,
      )
    } catch (error) {
      error.message = 'Error while generating trip | ' + error.message
      throw error
    }

    return this.combineDestinations(
      cacheDestination || { s: [] },
      generatedDestination,
      tripData.numberOfDays,
      tripData.stagesPerDay,
    )
  }

  // use user's destination's coordinates to find cacheable destinations to use
  async tryCache(tripData) {
    const tripLatLon = await getLatLon(tripData.tripLocation)

    const maxStagesToFetch = Math.floor(
      tripData.numberOfDays * tripData.stagesPerDay * 0.8,
    )

    if (maxStagesToFetch === 0) {
      return null
    }

    const cachedDestinations = await this.findClosestDestinations(
      tripLatLon.lat,
      tripLatLon.lng,
      maxStagesToFetch,
    )

    let index = 0
    const s = []

    while (index < cachedDestinations.length) {
      const destination = cachedDestinations[index++]
      s.push({
        i: index,
        l: destination.alias ? destination.alias[0] : destination.name,
        d: destination.description,
        e: destination.emoji,
      })
    }

    return { s }
  }

  combineDestinations(
    cachedStages,
    generatedStages,
    numberOfDays,
    stagesPerDay,
  ) {
    const combinedDestinations = []
    const allStages = [...cachedStages.s, ...generatedStages.s]
    let combinedStageIndex = 0

    for (let i = 0; i < numberOfDays; i++) {
      const stagesForDay = []
      let stageIndex = 0

      for (let j = 0; j < stagesPerDay; j++) {
        if (combinedStageIndex < allStages.length) {
          const stage = allStages[combinedStageIndex++]
          stageIndex++
          stagesForDay.push({
            stageIndex: stageIndex,
            stageLocationName: stage.l,
            stageDescription: stage.d,
            stageEmoji: stage.e,
          })
        }
      }

      combinedDestinations.push({
        day: i + 1,
        stages: stagesForDay,
      })
    }
    // combinedDestinations.forEach((day) => {
    //   console.log(day.stages)
    // })

    return {
      days: combinedDestinations,
    }
  }
}

module.exports = DestinationController
