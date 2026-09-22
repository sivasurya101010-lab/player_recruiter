from rest_framework import serializers

from .models import Game
from sports.models import Sports

from users.serializers import UserSerializer
from sports.serializers import SportSerializer


class GameSerializer(serializers.ModelSerializer):

    creator = UserSerializer(read_only=True)

    sport_details = SportSerializer(source='sport',read_only=True)

    # this sport is to validate the user providing sport id
    sport = serializers.PrimaryKeyRelatedField(queryset=Sports.objects.filter(is_active=True))

    current_palyers = serializers.SerializerMethodField()
    available_slots = serializers.SerializerMethodField()

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

    def get_current_palyers(self, values):
        return values.participation.count()

    def get_available_slots(self, values):
        return max(0,values.players_needed - values.participation.count())

    def validate_players_needed(self, value):

        if value <= 0:
            raise serializers.ValidationError("minimum 1 player required")

        return value

    def validate_duration(self, value):

        if value <= 0:
            raise serializers.ValidationError("Duration must be greater than 0 minutes.")

        return value

    def validate(self, values):

        sport = values.get('sport')

        custom_sport_name = values.get('custom_sport_name','').strip()

        if sport.name == 'Other':

            if not custom_sport_name:
                raise serializers.ValidationError({'custom_sport_name':'Please specify the sport name when selecting Other.'})

        values['custom_sport_name'] = custom_sport_name

        return values