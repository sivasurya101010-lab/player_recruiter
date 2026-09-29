from rest_framework import serializers

from .models import Game
from sports.models import Sports

from users.serializers import UserSerializer
from sports.serializers import SportSerializer


class GameSerializer(serializers.ModelSerializer):

    creator = UserSerializer(read_only=True)

    sport_details = SportSerializer(source='sport', read_only=True)

    sport = serializers.PrimaryKeyRelatedField(
        queryset=Sports.objects.filter(is_active=True)
    )

    current_players = serializers.SerializerMethodField()
    available_slots = serializers.SerializerMethodField()
    is_joined = serializers.SerializerMethodField()
    is_creator = serializers.SerializerMethodField()

    class Meta:
        model = Game
        fields = '__all__'

        read_only_fields = [
            'id',
            'creator',
            'status',
            'created_at',
            'updated_at'
        ]

    def get_current_players(self, values):
        return values.participation.count()

    def get_available_slots(self, values):
        return max(0, values.players_needed - values.participation.count())

    def get_is_joined(self, values):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return values.participation.filter(user=request.user).exists()

    def get_is_creator(self, values):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return values.creator_id == request.user.id

    def validate_players_needed(self, value):

        if value <= 0:
            raise serializers.ValidationError("minimum 1 player required")

        return value

    def validate_duration(self, value):

        if value <= 0:
            raise serializers.ValidationError(
                "Duration must be greater than 0 minutes."
            )

        return value

    def validate(self, values):

        players_needed = values.get('players_needed')

        if self.instance and players_needed is not None:
            current_players = self.instance.participation.count()

            if players_needed < current_players:
                raise serializers.ValidationError({
                    'players_needed':
                        'Players needed cannot be less than the current number of players.'
                })

        sport = values.get('sport') or getattr(self.instance, 'sport', None)
        custom_sport_name = values.get('custom_sport_name', '').strip()

        if sport.name == 'Other' and not custom_sport_name:
            raise serializers.ValidationError({
                'custom_sport_name':
                    'Please specify the sport name when selecting Other.'
            })

        values['custom_sport_name'] = custom_sport_name

        return values
