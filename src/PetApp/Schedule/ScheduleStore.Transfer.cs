using Microsoft.Data.Sqlite;

namespace PetApp.Schedule;

internal sealed partial class ScheduleStore
{
    public IReadOnlyList<Dictionary<string, object?>> ListEventsForTransfer(IReadOnlyCollection<string> ids)
    {
        using var db = Open();
        db.Open();
        using var command = db.CreateCommand();
        if (ids.Count == 0)
        {
            command.CommandText = "SELECT * FROM events ORDER BY start_at";
        }
        else
        {
            var parameters = new List<string>();
            var index = 0;
            foreach (var id in ids.Distinct())
            {
                var parameter = "$id" + index++;
                parameters.Add(parameter);
                command.Parameters.AddWithValue(parameter, id);
            }
            command.CommandText = "SELECT * FROM events WHERE id IN (" + string.Join(", ", parameters) + ") ORDER BY start_at";
        }
        return ReadEvents(command);
    }
}
