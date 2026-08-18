using Microsoft.Data.Sqlite;

namespace PetApp.Schedule;

internal sealed partial class ScheduleStore
{
    private static void EnsureFocusSessionSchema(SqliteConnection db)
    {
        using var command = db.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS focus_sessions (
                id TEXT PRIMARY KEY,
                event_id TEXT NULL REFERENCES events(id) ON DELETE SET NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT NOT NULL,
                planned_seconds INTEGER NOT NULL,
                actual_seconds INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_focus_sessions_event ON focus_sessions(event_id, ended_at DESC);
            """;
        command.ExecuteNonQuery();
    }

    public void RecordFocusSession(string eventId, int plannedSeconds, int actualSeconds, DateTimeOffset endedAt)
    {
        if (string.IsNullOrWhiteSpace(eventId)) return;
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            INSERT INTO focus_sessions (id, event_id, started_at, ended_at, planned_seconds, actual_seconds)
            VALUES ($id, $eventId, $startedAt, $endedAt, $plannedSeconds, $actualSeconds)
            """;
        command.Parameters.AddWithValue("$id", Guid.NewGuid().ToString());
        command.Parameters.AddWithValue("$eventId", eventId);
        command.Parameters.AddWithValue("$startedAt", endedAt.AddSeconds(-Math.Max(0, actualSeconds)).ToString("O"));
        command.Parameters.AddWithValue("$endedAt", endedAt.ToString("O"));
        command.Parameters.AddWithValue("$plannedSeconds", Math.Max(0, plannedSeconds));
        command.Parameters.AddWithValue("$actualSeconds", Math.Max(0, actualSeconds));
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<Dictionary<string, object?>> ListFocusSessions(string eventId)
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT * FROM focus_sessions WHERE event_id = $eventId ORDER BY ended_at DESC LIMIT 100";
        command.Parameters.AddWithValue("$eventId", eventId);
        using var reader = command.ExecuteReader();
        var sessions = new List<Dictionary<string, object?>>();
        while (reader.Read())
        {
            sessions.Add(new Dictionary<string, object?>
            {
                ["id"] = reader.GetString(reader.GetOrdinal("id")),
                ["event_id"] = reader.IsDBNull(reader.GetOrdinal("event_id")) ? null : reader.GetString(reader.GetOrdinal("event_id")),
                ["started_at"] = reader.GetString(reader.GetOrdinal("started_at")),
                ["ended_at"] = reader.GetString(reader.GetOrdinal("ended_at")),
                ["planned_seconds"] = reader.GetInt32(reader.GetOrdinal("planned_seconds")),
                ["actual_seconds"] = reader.GetInt32(reader.GetOrdinal("actual_seconds"))
            });
        }
        return sessions;
    }
}
