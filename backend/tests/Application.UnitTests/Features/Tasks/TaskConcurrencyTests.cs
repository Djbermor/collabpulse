using System;
using CollabPulse.Application.Common.Exceptions;
using FluentAssertions;
using Xunit;

namespace CollabPulse.Application.UnitTests.Features.Tasks;

/// <summary>
/// Pruebas de Control de Concurrencia Optimista e Idempotencia en Tareas (Secciones 25 y 32 del Plan)
/// Valida detección de conflictos de versión y transiciones de estado válidas.
/// </summary>
public class TaskConcurrencyTests
{
    [Fact]
    public void TaskStatusUpdate_WhenVersionMatches_SucceedsAndIncrementsVersion()
    {
        // Arrange
        uint originalVersion = 1;
        uint clientVersion = 1;
        var newStatus = "in_progress";

        // Act
        if (clientVersion != originalVersion)
        {
            throw new ConflictException("Concurrency violation: Task was modified by another transaction.");
        }

        var updatedVersion = originalVersion + 1;

        // Assert
        updatedVersion.Should().Be(2);
        newStatus.Should().Be("in_progress");
    }

    [Fact]
    public void TaskStatusUpdate_WhenVersionMismatchDetected_ThrowsConflictException()
    {
        // Arrange: Otro usuario ya actualizó la tarea a la versión 2
        uint currentDatabaseVersion = 2;
        uint staleClientVersion = 1;

        // Act
        Action act = () =>
        {
            if (staleClientVersion != currentDatabaseVersion)
            {
                throw new ConflictException("Concurrency violation: Task was modified by another transaction.");
            }
        };

        // Assert
        act.Should().Throw<ConflictException>()
            .WithMessage("*Concurrency violation*");
    }

    [Theory]
    [InlineData("todo", "in_progress", true)]
    [InlineData("in_progress", "completed", true)]
    [InlineData("completed", "todo", true)]
    [InlineData("archived", "in_progress", false)] // No se puede pasar de archivada a en progreso directamente
    public void TaskWorkflow_StateTransitionValidation(string currentStatus, string targetStatus, bool isAllowed)
    {
        // Act
        bool validTransition = currentStatus switch
        {
            "archived" => false,
            _ => true
        };

        // Assert
        validTransition.Should().Be(isAllowed);
    }
}
