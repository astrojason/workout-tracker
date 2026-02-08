import Foundation

struct CSVParser {
    enum CSVError: LocalizedError {
        case invalidHeader(String)
        case invalidColumnCount(line: Int, expected: Int, got: Int)
        case invalidField(field: String, line: Int, value: String)
        case emptyFile
        case fileNotFound(String)

        var errorDescription: String? {
            switch self {
            case .invalidHeader(let msg): return "Invalid CSV header: \(msg)"
            case .invalidColumnCount(let line, let expected, let got):
                return "Line \(line): expected \(expected) columns, got \(got)"
            case .invalidField(let field, let line, let value):
                return "Line \(line): invalid value '\(value)' for field '\(field)'"
            case .emptyFile: return "CSV file is empty"
            case .fileNotFound(let name): return "File not found: \(name)"
            }
        }
    }

    static let expectedHeaders = [
        "program_name", "week", "day_of_week", "phase", "exercise_order",
        "exercise_name", "equipment_type", "equipment_detail", "base_weight",
        "sets", "rep_min", "rep_max", "rest_seconds", "progression_rule",
        "unilateral", "notes"
    ]

    // MARK: - Public API

    static func loadBundled() -> [Program] {
        var programs: [Program] = []
        let csvFiles = ["reacher_build_workout", "daily_mobility"]

        for fileName in csvFiles {
            guard let url = Bundle.main.url(forResource: fileName, withExtension: "csv") else {
                print("CSVParser: Could not find \(fileName).csv in bundle")
                continue
            }
            do {
                let content = try String(contentsOf: url, encoding: .utf8)
                let parsed = try parse(csvString: content)
                programs.append(contentsOf: parsed)
            } catch {
                print("CSVParser: Error parsing \(fileName).csv: \(error.localizedDescription)")
            }
        }
        return programs
    }

    static func loadFromURL(_ url: URL) throws -> [Program] {
        let accessing = url.startAccessingSecurityScopedResource()
        defer {
            if accessing { url.stopAccessingSecurityScopedResource() }
        }
        let content = try String(contentsOf: url, encoding: .utf8)
        return try parse(csvString: content)
    }

    // MARK: - Parsing

    static func parse(csvString: String) throws -> [Program] {
        let lines = csvString.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        guard !lines.isEmpty else { throw CSVError.emptyFile }

        // Validate header
        let headerColumns = parseCSVLine(lines[0])
        let normalizedHeaders = headerColumns.map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
        for (i, expected) in expectedHeaders.enumerated() {
            guard i < normalizedHeaders.count, normalizedHeaders[i] == expected else {
                throw CSVError.invalidHeader("Expected '\(expected)' at column \(i + 1)")
            }
        }

        // Parse rows
        struct RawRow {
            let programName: String
            let week: Int
            let dayOfWeek: String
            let exercise: Exercise
        }

        var rows: [RawRow] = []
        for (lineIndex, line) in lines.dropFirst().enumerated() {
            let lineNumber = lineIndex + 2
            let columns = parseCSVLine(line)

            // Allow trailing empty columns
            guard columns.count >= expectedHeaders.count else {
                throw CSVError.invalidColumnCount(line: lineNumber, expected: expectedHeaders.count, got: columns.count)
            }

            let row = try parseRow(columns: columns, lineNumber: lineNumber)
            rows.append(row)
        }

        // Group into Programs
        return buildPrograms(from: rows)
    }

    // MARK: - Row Parsing

    private static func parseRow(columns: [String], lineNumber: Int) throws -> (programName: String, week: Int, dayOfWeek: String, exercise: Exercise) {
        let col = columns.map { $0.trimmingCharacters(in: .whitespaces) }

        let programName = col[0]
        guard let week = Int(col[1]) else {
            throw CSVError.invalidField(field: "week", line: lineNumber, value: col[1])
        }
        let dayOfWeek = col[2]

        guard let phase = Phase(rawValue: col[3].lowercased()) else {
            throw CSVError.invalidField(field: "phase", line: lineNumber, value: col[3])
        }

        guard let order = Int(col[4]) else {
            throw CSVError.invalidField(field: "exercise_order", line: lineNumber, value: col[4])
        }

        let name = col[5]

        guard let equipmentType = EquipmentType(rawValue: col[6]) else {
            throw CSVError.invalidField(field: "equipment_type", line: lineNumber, value: col[6])
        }

        let equipmentDetail: String? = col[7].isEmpty ? nil : col[7]
        let baseWeight = WeightSpec(csvValue: col[8])

        guard let sets = Int(col[9]) else {
            throw CSVError.invalidField(field: "sets", line: lineNumber, value: col[9])
        }

        guard let repMin = Int(col[10]) else {
            throw CSVError.invalidField(field: "rep_min", line: lineNumber, value: col[10])
        }

        let repMax = RepTarget(csvValue: col[11])

        guard let restSeconds = Int(col[12]) else {
            throw CSVError.invalidField(field: "rest_seconds", line: lineNumber, value: col[12])
        }

        let progressionRule: ProgressionRule
        let ruleStr = col[13]
        if let rule = ProgressionRule(rawValue: ruleStr) {
            progressionRule = rule
        } else {
            // Try common alternatives
            progressionRule = .none
        }

        let unilateral = col[14].uppercased() == "TRUE"

        let notes: String? = col.count > 15 && !col[15].isEmpty ? col[15] : nil

        let exercise = Exercise(
            id: UUID(),
            order: order,
            name: name,
            phase: phase,
            equipmentType: equipmentType,
            equipmentDetail: equipmentDetail,
            baseWeight: baseWeight,
            sets: sets,
            repMin: repMin,
            repMax: repMax,
            restSeconds: restSeconds,
            progressionRule: progressionRule,
            isUnilateral: unilateral,
            notes: notes
        )

        return (programName, week, dayOfWeek, exercise)
    }

    // MARK: - CSV Line Parsing (handles commas in quoted fields)

    private static func parseCSVLine(_ line: String) -> [String] {
        var result: [String] = []
        var current = ""
        var inQuotes = false

        for char in line {
            if char == "\"" {
                inQuotes.toggle()
            } else if char == "," && !inQuotes {
                result.append(current)
                current = ""
            } else {
                current.append(char)
            }
        }
        result.append(current)
        return result
    }

    // MARK: - Build Program Hierarchy

    private static func buildPrograms(from rows: [(programName: String, week: Int, dayOfWeek: String, exercise: Exercise)]) -> [Program] {
        // Group by program name
        var programGroups: [String: [(week: Int, day: String, exercise: Exercise)]] = [:]
        for row in rows {
            programGroups[row.programName, default: []].append((row.week, row.dayOfWeek, row.exercise))
        }

        var programs: [Program] = []

        for (programName, entries) in programGroups {
            // Group by week -> day -> exercises
            var workoutsByWeekAndDay: [Int: [String: Workout]] = [:]
            var maxWeek = 1

            // Group entries by (week, day)
            var grouped: [Int: [String: [Exercise]]] = [:]
            for entry in entries {
                grouped[entry.week, default: [:]][entry.day, default: []].append(entry.exercise)
                maxWeek = max(maxWeek, entry.week)
            }

            for (week, dayExercises) in grouped {
                for (day, exercises) in dayExercises {
                    let sorted = exercises.sorted { $0.order < $1.order }
                    let workout = Workout(
                        id: UUID(),
                        programName: programName,
                        week: week,
                        dayOfWeek: day,
                        exercises: sorted
                    )
                    workoutsByWeekAndDay[week, default: [:]][day] = workout
                }
            }

            let program = Program(
                id: UUID(),
                name: programName,
                totalWeeks: maxWeek,
                currentWeek: 1,
                workoutsByWeekAndDay: workoutsByWeekAndDay
            )
            programs.append(program)
        }

        return programs.sorted { $0.name < $1.name }
    }
}
