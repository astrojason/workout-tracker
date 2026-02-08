import CoreData
import Foundation

class CoreDataStack {
    static let shared = CoreDataStack()

    lazy var container: NSPersistentContainer = {
        let container = NSPersistentContainer(name: "WorkoutHistory", managedObjectModel: Self.model)
        container.loadPersistentStores { description, error in
            if let error {
                fatalError("Core Data failed to load: \(error.localizedDescription)")
            }
        }
        container.viewContext.automaticallyMergesChangesFromParent = true
        return container
    }()

    var context: NSManagedObjectContext {
        container.viewContext
    }

    // MARK: - Programmatic Core Data Model

    static let model: NSManagedObjectModel = {
        let model = NSManagedObjectModel()

        // WorkoutSessionEntity
        let sessionEntity = NSEntityDescription()
        sessionEntity.name = "WorkoutSessionEntity"
        sessionEntity.managedObjectClassName = "WorkoutSessionEntity"

        let sessionId = NSAttributeDescription()
        sessionId.name = "id"
        sessionId.attributeType = .UUIDAttributeType

        let sessionProgram = NSAttributeDescription()
        sessionProgram.name = "programName"
        sessionProgram.attributeType = .stringAttributeType

        let sessionWeek = NSAttributeDescription()
        sessionWeek.name = "week"
        sessionWeek.attributeType = .integer16AttributeType

        let sessionDay = NSAttributeDescription()
        sessionDay.name = "dayOfWeek"
        sessionDay.attributeType = .stringAttributeType

        let sessionDate = NSAttributeDescription()
        sessionDate.name = "date"
        sessionDate.attributeType = .dateAttributeType

        let sessionCompleted = NSAttributeDescription()
        sessionCompleted.name = "completed"
        sessionCompleted.attributeType = .booleanAttributeType
        sessionCompleted.defaultValue = false

        let sessionDuration = NSAttributeDescription()
        sessionDuration.name = "durationSeconds"
        sessionDuration.attributeType = .integer32AttributeType
        sessionDuration.defaultValue = 0

        // ExerciseSetEntity
        let setEntity = NSEntityDescription()
        setEntity.name = "ExerciseSetEntity"
        setEntity.managedObjectClassName = "ExerciseSetEntity"

        let setId = NSAttributeDescription()
        setId.name = "id"
        setId.attributeType = .UUIDAttributeType

        let setExerciseName = NSAttributeDescription()
        setExerciseName.name = "exerciseName"
        setExerciseName.attributeType = .stringAttributeType

        let setExerciseOrder = NSAttributeDescription()
        setExerciseOrder.name = "exerciseOrder"
        setExerciseOrder.attributeType = .integer16AttributeType

        let setNumber = NSAttributeDescription()
        setNumber.name = "setNumber"
        setNumber.attributeType = .integer16AttributeType

        let setTargetWeight = NSAttributeDescription()
        setTargetWeight.name = "targetWeight"
        setTargetWeight.attributeType = .doubleAttributeType
        setTargetWeight.defaultValue = 0.0

        let setActualWeight = NSAttributeDescription()
        setActualWeight.name = "actualWeight"
        setActualWeight.attributeType = .doubleAttributeType
        setActualWeight.defaultValue = 0.0

        let setTargetReps = NSAttributeDescription()
        setTargetReps.name = "targetReps"
        setTargetReps.attributeType = .integer16AttributeType

        let setActualReps = NSAttributeDescription()
        setActualReps.name = "actualReps"
        setActualReps.attributeType = .integer16AttributeType

        let setCompleted = NSAttributeDescription()
        setCompleted.name = "completed"
        setCompleted.attributeType = .booleanAttributeType
        setCompleted.defaultValue = true

        let setTimestamp = NSAttributeDescription()
        setTimestamp.name = "timestamp"
        setTimestamp.attributeType = .dateAttributeType

        let setNotes = NSAttributeDescription()
        setNotes.name = "notes"
        setNotes.attributeType = .stringAttributeType
        setNotes.isOptional = true

        // Relationships
        let sessionToSets = NSRelationshipDescription()
        sessionToSets.name = "sets"
        sessionToSets.destinationEntity = setEntity
        sessionToSets.isOrdered = true
        sessionToSets.minCount = 0
        sessionToSets.maxCount = 0 // to-many
        sessionToSets.deleteRule = .cascadeDeleteRule

        let setToSession = NSRelationshipDescription()
        setToSession.name = "session"
        setToSession.destinationEntity = sessionEntity
        setToSession.minCount = 0
        setToSession.maxCount = 1
        setToSession.deleteRule = .nullifyDeleteRule

        sessionToSets.inverseRelationship = setToSession
        setToSession.inverseRelationship = sessionToSets

        sessionEntity.properties = [
            sessionId, sessionProgram, sessionWeek, sessionDay,
            sessionDate, sessionCompleted, sessionDuration, sessionToSets
        ]

        setEntity.properties = [
            setId, setExerciseName, setExerciseOrder, setNumber,
            setTargetWeight, setActualWeight, setTargetReps, setActualReps,
            setCompleted, setTimestamp, setNotes, setToSession
        ]

        // PersonalRecordEntity
        let prEntity = NSEntityDescription()
        prEntity.name = "PersonalRecordEntity"
        prEntity.managedObjectClassName = "PersonalRecordEntity"

        let prId = NSAttributeDescription()
        prId.name = "id"
        prId.attributeType = .UUIDAttributeType

        let prExerciseName = NSAttributeDescription()
        prExerciseName.name = "exerciseName"
        prExerciseName.attributeType = .stringAttributeType

        let prRecordType = NSAttributeDescription()
        prRecordType.name = "recordType"
        prRecordType.attributeType = .stringAttributeType

        let prValue = NSAttributeDescription()
        prValue.name = "value"
        prValue.attributeType = .doubleAttributeType

        let prDate = NSAttributeDescription()
        prDate.name = "date"
        prDate.attributeType = .dateAttributeType

        prEntity.properties = [prId, prExerciseName, prRecordType, prValue, prDate]

        model.entities = [sessionEntity, setEntity, prEntity]
        return model
    }()

    // MARK: - Save Workout Session

    func saveWorkoutSession(
        programName: String,
        week: Int,
        dayOfWeek: String,
        completed: Bool,
        durationSeconds: Int,
        sets: [CompletedSet]
    ) {
        let ctx = context

        let session = NSEntityDescription.insertNewObject(forEntityName: "WorkoutSessionEntity", into: ctx)
        session.setValue(UUID(), forKey: "id")
        session.setValue(programName, forKey: "programName")
        session.setValue(Int16(week), forKey: "week")
        session.setValue(dayOfWeek, forKey: "dayOfWeek")
        session.setValue(Date(), forKey: "date")
        session.setValue(completed, forKey: "completed")
        session.setValue(Int32(durationSeconds), forKey: "durationSeconds")

        let orderedSets = session.mutableOrderedSetValue(forKey: "sets")

        for completedSet in sets {
            let setObj = NSEntityDescription.insertNewObject(forEntityName: "ExerciseSetEntity", into: ctx)
            setObj.setValue(UUID(), forKey: "id")
            setObj.setValue(completedSet.exerciseName, forKey: "exerciseName")
            setObj.setValue(Int16(completedSet.exerciseOrder), forKey: "exerciseOrder")
            setObj.setValue(Int16(completedSet.setNumber), forKey: "setNumber")
            setObj.setValue(completedSet.targetWeight, forKey: "targetWeight")
            setObj.setValue(completedSet.actualWeight, forKey: "actualWeight")
            setObj.setValue(Int16(completedSet.targetReps), forKey: "targetReps")
            setObj.setValue(Int16(completedSet.actualReps), forKey: "actualReps")
            setObj.setValue(completedSet.completed, forKey: "completed")
            setObj.setValue(completedSet.timestamp, forKey: "timestamp")
            setObj.setValue(completedSet.notes, forKey: "notes")
            orderedSets.add(setObj)
        }

        save()
    }

    // MARK: - Fetch Sessions

    func fetchSessions(programName: String? = nil, limit: Int? = nil) -> [NSManagedObject] {
        let request = NSFetchRequest<NSManagedObject>(entityName: "WorkoutSessionEntity")
        request.sortDescriptors = [NSSortDescriptor(key: "date", ascending: false)]

        if let programName {
            request.predicate = NSPredicate(format: "programName == %@", programName)
        }
        if let limit {
            request.fetchLimit = limit
        }

        return (try? context.fetch(request)) ?? []
    }

    func fetchCompletedDays(programName: String, week: Int) -> Set<String> {
        let request = NSFetchRequest<NSManagedObject>(entityName: "WorkoutSessionEntity")
        request.predicate = NSPredicate(
            format: "programName == %@ AND week == %d AND completed == YES",
            programName, week
        )

        let results = (try? context.fetch(request)) ?? []
        return Set(results.compactMap { $0.value(forKey: "dayOfWeek") as? String })
    }

    // MARK: - Fetch Exercise History

    func fetchLastSetsForExercise(name: String) -> [NSManagedObject] {
        let request = NSFetchRequest<NSManagedObject>(entityName: "ExerciseSetEntity")
        request.predicate = NSPredicate(format: "exerciseName == %@", name)
        request.sortDescriptors = [NSSortDescriptor(key: "timestamp", ascending: false)]

        let allSets = (try? context.fetch(request)) ?? []
        guard let lastTimestamp = allSets.first?.value(forKey: "timestamp") as? Date else {
            return []
        }

        // Get the session ID for the most recent workout containing this exercise
        guard let lastSession = allSets.first?.value(forKey: "session") as? NSManagedObject,
              let sessionId = lastSession.value(forKey: "id") as? UUID else {
            return []
        }

        // Return all sets for this exercise from that session
        return allSets.filter { set in
            guard let session = set.value(forKey: "session") as? NSManagedObject,
                  let id = session.value(forKey: "id") as? UUID else { return false }
            return id == sessionId
        }
    }

    func fetchExerciseHistory(name: String, limit: Int = 50) -> [(date: Date, weight: Double, reps: Int, volume: Double)] {
        let request = NSFetchRequest<NSManagedObject>(entityName: "ExerciseSetEntity")
        request.predicate = NSPredicate(format: "exerciseName == %@", name)
        request.sortDescriptors = [NSSortDescriptor(key: "timestamp", ascending: true)]
        request.fetchLimit = limit

        let sets = (try? context.fetch(request)) ?? []

        return sets.compactMap { set in
            guard let date = set.value(forKey: "timestamp") as? Date else { return nil }
            let weight = set.value(forKey: "actualWeight") as? Double ?? 0
            let reps = set.value(forKey: "actualReps") as? Int16 ?? 0
            return (date: date, weight: weight, reps: Int(reps), volume: weight * Double(reps))
        }
    }

    func fetchAllExerciseNames() -> [String] {
        let request = NSFetchRequest<NSManagedObject>(entityName: "ExerciseSetEntity")
        request.propertiesToFetch = ["exerciseName"]
        request.returnsDistinctResults = true
        request.resultType = .dictionaryResultType

        let results = (try? context.fetch(request)) ?? []
        return results.compactMap { ($0 as? NSDictionary)?["exerciseName"] as? String }.sorted()
    }

    // MARK: - PR Management

    func fetchPR(exerciseName: String, type: String) -> Double? {
        let request = NSFetchRequest<NSManagedObject>(entityName: "PersonalRecordEntity")
        request.predicate = NSPredicate(format: "exerciseName == %@ AND recordType == %@", exerciseName, type)
        request.fetchLimit = 1

        let results = (try? context.fetch(request)) ?? []
        return results.first?.value(forKey: "value") as? Double
    }

    func savePR(exerciseName: String, type: String, value: Double) {
        // Update existing or create new
        let request = NSFetchRequest<NSManagedObject>(entityName: "PersonalRecordEntity")
        request.predicate = NSPredicate(format: "exerciseName == %@ AND recordType == %@", exerciseName, type)

        if let existing = (try? context.fetch(request))?.first {
            existing.setValue(value, forKey: "value")
            existing.setValue(Date(), forKey: "date")
        } else {
            let pr = NSEntityDescription.insertNewObject(forEntityName: "PersonalRecordEntity", into: context)
            pr.setValue(UUID(), forKey: "id")
            pr.setValue(exerciseName, forKey: "exerciseName")
            pr.setValue(type, forKey: "recordType")
            pr.setValue(value, forKey: "value")
            pr.setValue(Date(), forKey: "date")
        }

        save()
    }

    // MARK: - Helpers

    func save() {
        guard context.hasChanges else { return }
        do {
            try context.save()
        } catch {
            print("Core Data save error: \(error.localizedDescription)")
        }
    }

    func deleteAllData() {
        for entityName in ["WorkoutSessionEntity", "ExerciseSetEntity", "PersonalRecordEntity"] {
            let request = NSFetchRequest<NSManagedObject>(entityName: entityName)
            let results = (try? context.fetch(request)) ?? []
            results.forEach { context.delete($0) }
        }
        save()
    }
}
