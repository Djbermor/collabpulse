using CollabPulse.Contracts.Auth;
using CollabPulse.Contracts.Channels;
using CollabPulse.Contracts.Common;
using CollabPulse.Contracts.Messages;
using CollabPulse.Contracts.Workspaces;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace CollabPulse.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public abstract class ApiControllerBase : ControllerBase
{
    private ISender? _mediator;
    protected ISender Mediator => _mediator ??= HttpContext.RequestServices.GetRequiredService<ISender>();

    protected Guid CurrentTenantId
    {
        get
        {
            if (HttpContext.Items.TryGetValue("TenantId", out var val) && val is Guid g)
                return g;
            return Guid.Empty;
        }
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ApiControllerBase
{
    [HttpPost("register")]
    public ActionResult<AuthResponse> Register([FromBody] RegisterRequest request)
    {
        var id = Guid.NewGuid();
        var response = new AuthResponse(
            AccessToken: "jwt-token-" + id,
            RefreshToken: "refresh-token-" + id,
            ExpiresAt: DateTimeOffset.UtcNow.AddHours(2),
            User: new UserSummaryDto(id, request.Email, request.FullName, null, "Online")
        );
        return Ok(response);
    }

    [HttpPost("login")]
    public ActionResult<AuthResponse> Login([FromBody] LoginRequest request)
    {
        var id = Guid.NewGuid();
        var response = new AuthResponse(
            AccessToken: "jwt-token-" + id,
            RefreshToken: "refresh-token-" + id,
            ExpiresAt: DateTimeOffset.UtcNow.AddHours(2),
            User: new UserSummaryDto(id, request.Email, "Platform User", null, "Online")
        );
        return Ok(response);
    }

    [HttpPost("refresh-token")]
    public ActionResult<AuthResponse> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var id = Guid.NewGuid();
        var response = new AuthResponse(
            AccessToken: "new-jwt-token-" + id,
            RefreshToken: "new-refresh-token-" + id,
            ExpiresAt: DateTimeOffset.UtcNow.AddHours(2),
            User: new UserSummaryDto(id, "user@collabpulse.com", "Active User", null, "Online")
        );
        return Ok(response);
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class WorkspacesController : ApiControllerBase
{
    [HttpGet]
    public ActionResult<IReadOnlyList<WorkspaceResponse>> GetWorkspaces()
    {
        var list = new List<WorkspaceResponse>
        {
            new(Guid.NewGuid(), "Acme Corporation", "acme-corp", "Primary enterprise workspace", DateTimeOffset.UtcNow, "Owner")
        };
        return Ok(list);
    }

    [HttpPost]
    public ActionResult<WorkspaceResponse> CreateWorkspace([FromBody] CreateWorkspaceRequest request)
    {
        var response = new WorkspaceResponse(Guid.NewGuid(), request.Name, request.Slug ?? "workspace", request.Description, DateTimeOffset.UtcNow, "Owner");
        return CreatedAtAction(nameof(GetWorkspaces), response);
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class ChannelsController : ApiControllerBase
{
    [HttpGet]
    public ActionResult<IReadOnlyList<ChannelResponse>> GetChannels([FromQuery] Guid workspaceId)
    {
        var list = new List<ChannelResponse>
        {
            new(Guid.NewGuid(), workspaceId, "general", "General workspace discussion", false, 42, DateTimeOffset.UtcNow),
            new(Guid.NewGuid(), workspaceId, "engineering", "Technical architecture and sprints", false, 18, DateTimeOffset.UtcNow)
        };
        return Ok(list);
    }

    [HttpPost]
    public ActionResult<ChannelResponse> CreateChannel([FromBody] CreateChannelRequest request)
    {
        var response = new ChannelResponse(Guid.NewGuid(), request.WorkspaceId, request.Name, request.Topic, request.IsPrivate, 1, DateTimeOffset.UtcNow);
        return CreatedAtAction(nameof(GetChannels), response);
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class MessagesController : ApiControllerBase
{
    [HttpGet]
    public ActionResult<PagedResult<MessageResponse>> GetMessages([FromQuery] Guid? channelId, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 50)
    {
        var items = new List<MessageResponse>
        {
            new(Guid.NewGuid(), channelId, null, Guid.NewGuid(), "Alex Rivera", null, "Welcome to CollabPulse Enterprise!", 0, false, DateTimeOffset.UtcNow, null, 0)
        };
        return Ok(new PagedResult<MessageResponse>(items, pageNumber, pageSize, 1, false, false));
    }

    [HttpPost]
    public ActionResult<MessageResponse> SendMessage([FromBody] SendMessageRequest request)
    {
        var response = new MessageResponse(Guid.NewGuid(), request.ChannelId, request.ConversationId, Guid.NewGuid(), "You", null, request.Content, request.Type, false, DateTimeOffset.UtcNow, null, 0);
        return Ok(response);
    }
}
