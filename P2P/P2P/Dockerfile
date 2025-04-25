# Base image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

# Build image
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore /src/P2P.csproj
RUN dotnet build /src/P2P.csproj -c Release -o /app/build

# Publish image
FROM build AS publish
RUN dotnet publish "P2P.csproj" -c Release -o /app/publish

# Final image
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "P2P.dll"]
#COPY database.db ./database.db
