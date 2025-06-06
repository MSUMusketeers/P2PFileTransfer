# Use the official .NET SDK image to build the app
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy everything to the container
COPY . .

# Restore dependencies
RUN dotnet restore "P2P.csproj"

# Build the project
RUN dotnet build "P2P.csproj" -c Release -o /app/build

# Publish the app
RUN dotnet publish "P2P.csproj" -c Release -o /app/publish

# Use the runtime image for final image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Copy the published output
COPY --from=build /app/publish .

# Copy database.db into the container (ensure it has the correct tables)
COPY database.db ./database.db

# Expose the correct port
EXPOSE 8080

ENTRYPOINT ["dotnet", "P2P.dll"]
