using CollabPulse.Application;
using CollabPulse.Infrastructure;
using CollabPulse.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);

builder.Services.AddHostedService<EmailBackgroundService>();
builder.Services.AddHostedService<NotificationDispatcherService>();
builder.Services.AddHostedService<CleanupBackgroundService>();
builder.Services.AddHostedService<CalendarReminderService>();

var host = builder.Build();
host.Run();
