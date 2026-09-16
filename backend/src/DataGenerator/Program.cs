using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Bogus;
using CommandLine;
using Npgsql;

namespace CollabPulse.DataGenerator;

public class Options
{
    [Option('u', "users", Required = false, Default = 50, HelpText = "Número de usuarios a generar")]
    public int Users { get; set; }

    [Option('w', "workspaces", Required = false, Default = 2, HelpText = "Número de workspaces a generar")]
    public int Workspaces { get; set; }

    [Option('c', "channels", Required = false, Default = 10, HelpText = "Número de canales a generar")]
    public int Channels { get; set; }

    [Option('m', "messages", Required = false, Default = 500, HelpText = "Número de mensajes a generar")]
    public int Messages { get; set; }

    [Option('t', "tasks", Required = false, Default = 50, HelpText = "Número de tareas Kanban a generar")]
    public int Tasks { get; set; }

    [Option('f', "files", Required = false, Default = 20, HelpText = "Número de registros de archivos a generar")]
    public int Files { get; set; }

    [Option("connection", Required = false, Default = "Host=localhost;Port=5432;Database=collabpulse_test;Username=postgres;Password=postgres", HelpText = "Cadena de conexión PostgreSQL")]
    public string ConnectionString { get; set; } = string.Empty;
}

public class Program
{
    public static async Task<int> Main(string[] args)
    {
        return await Parser.Default.ParseArguments<Options>(args)
            .MapResult(async opts =>
            {
                Console.WriteLine("==========================================================");
                Console.WriteLine(" CollabPulse Enterprise — High-Scale Synthetic Data Generator");
                Console.WriteLine($" Target: {opts.Users} Users | {opts.Workspaces} Workspaces | {opts.Channels} Channels | {opts.Messages} Messages");
                Console.WriteLine("==========================================================");

                try
                {
                    await using var conn = new NpgsqlConnection(opts.ConnectionString);
                    await conn.OpenAsync();
                    Console.WriteLine("[+] Conectado a la base de datos con éxito.");

                    var faker = new Faker("es");
                    var userIds = new List<Guid>();
                    var workspaceIds = new List<Guid>();
                    var channelIds = new List<Guid>();

                    // 1. Generar Usuarios
                    Console.WriteLine($"[+] Generando {opts.Users} usuarios...");
                    for (int i = 0; i < opts.Users; i++)
                    {
                        var userId = Guid.NewGuid();
                        var email = faker.Internet.UniqueIndex + "_" + faker.Internet.Email();
                        var username = "user_" + faker.Random.AlphaNumeric(8).ToLower();
                        var fullName = faker.Name.FullName();

                        await using var cmd = new NpgsqlCommand(
                            "INSERT INTO users (id, email, username, full_name, password_hash, status, is_email_verified, created_at, updated_at) " +
                            "VALUES (@id, @email, @username, @name, @hash, 'active', true, NOW(), NOW()) ON CONFLICT DO NOTHING;", conn);
                        cmd.Parameters.AddWithValue("id", userId);
                        cmd.Parameters.AddWithValue("email", email);
                        cmd.Parameters.AddWithValue("username", username);
                        cmd.Parameters.AddWithValue("name", fullName);
                        cmd.Parameters.AddWithValue("hash", "$argon2id$v=19$m=65536,t=3,p=4$syntheticHashForTestingOnly=");

                        await cmd.ExecuteNonQueryAsync();
                        userIds.Add(userId);
                    }

                    // 2. Generar Workspaces
                    Console.WriteLine($"[+] Generando {opts.Workspaces} workspaces...");
                    for (int w = 0; w < opts.Workspaces; w++)
                    {
                        var wsId = Guid.NewGuid();
                        var tenantId = Guid.NewGuid();
                        var name = faker.Company.CompanyName() + " Pulse";
                        var slug = "ws-" + faker.Random.AlphaNumeric(6).ToLower();
                        var ownerId = userIds[w % userIds.Count];

                        await using var tCmd = new NpgsqlCommand(
                            "INSERT INTO tenants (id, name, slug, status, created_at, updated_at) VALUES (@id, @name, @slug, 'active', NOW(), NOW()) ON CONFLICT DO NOTHING;", conn);
                        tCmd.Parameters.AddWithValue("id", tenantId);
                        tCmd.Parameters.AddWithValue("name", name);
                        tCmd.Parameters.AddWithValue("slug", slug);
                        await tCmd.ExecuteNonQueryAsync();

                        await using var wsCmd = new NpgsqlCommand(
                            "INSERT INTO workspaces (id, tenant_id, name, slug, owner_id, status, created_at, updated_at) VALUES (@id, @tId, @name, @slug, @owner, 'active', NOW(), NOW()) ON CONFLICT DO NOTHING;", conn);
                        wsCmd.Parameters.AddWithValue("id", wsId);
                        wsCmd.Parameters.AddWithValue("tId", tenantId);
                        wsCmd.Parameters.AddWithValue("name", name);
                        wsCmd.Parameters.AddWithValue("slug", slug);
                        wsCmd.Parameters.AddWithValue("owner", ownerId);
                        await wsCmd.ExecuteNonQueryAsync();

                        workspaceIds.Add(wsId);
                    }

                    // 3. Generar Canales
                    Console.WriteLine($"[+] Generando {opts.Channels} canales...");
                    for (int c = 0; c < opts.Channels; c++)
                    {
                        var chId = Guid.NewGuid();
                        var wsId = workspaceIds[c % workspaceIds.Count];
                        var name = "canal-" + faker.Commerce.Department().ToLower().Replace(" ", "-") + "-" + c;
                        var ownerId = userIds[c % userIds.Count];

                        await using var chCmd = new NpgsqlCommand(
                            "INSERT INTO channels (id, workspace_id, name, slug, topic, is_private, created_by, status, created_at, updated_at) VALUES (@id, @wsId, @name, @name, @topic, false, @creator, 'active', NOW(), NOW()) ON CONFLICT DO NOTHING;", conn);
                        chCmd.Parameters.AddWithValue("id", chId);
                        chCmd.Parameters.AddWithValue("wsId", wsId);
                        chCmd.Parameters.AddWithValue("name", name);
                        chCmd.Parameters.AddWithValue("topic", faker.Lorem.Sentence());
                        chCmd.Parameters.AddWithValue("creator", ownerId);
                        await chCmd.ExecuteNonQueryAsync();

                        channelIds.Add(chId);
                    }

                    // 4. Generar Mensajes
                    Console.WriteLine($"[+] Generando {opts.Messages} mensajes en canales...");
                    for (int m = 0; m < opts.Messages; m++)
                    {
                        var msgId = Guid.NewGuid();
                        var chId = channelIds[m % channelIds.Count];
                        var authorId = userIds[m % userIds.Count];
                        var content = faker.Rant.Review();

                        await using var mCmd = new NpgsqlCommand(
                            "INSERT INTO messages (id, channel_id, user_id, content, type, status, is_edited, reply_count, created_at, updated_at) VALUES (@id, @chId, @author, @content, 'text', 'sent', false, 0, NOW(), NOW());", conn);
                        mCmd.Parameters.AddWithValue("id", msgId);
                        mCmd.Parameters.AddWithValue("chId", chId);
                        mCmd.Parameters.AddWithValue("author", authorId);
                        mCmd.Parameters.AddWithValue("content", content);
                        await mCmd.ExecuteNonQueryAsync();
                    }

                    Console.WriteLine("[✓] Generación sintética masiva completada con éxito.");
                    return 0;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[!] Error durante la generación de datos: {ex.Message}");
                    return 1;
                }
            },
            errs => Task.FromResult(1));
    }
}
