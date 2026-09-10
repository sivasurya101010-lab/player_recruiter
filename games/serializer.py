from rest_framework import serializers

from .models import Game,GamePlayer
from sports.models import Sports

class GameSerializer(serializers.ModelSerializer):

    current_palyers=serializers.SerializerMethodField
    available_slots=serializers.SerializerMethodField

    class Meta:
        model=Game
        fields= '__all__'
        read_only_fields = ['id','creator','status','created_at','updated_at']

    def get_current_palyers(self,values):
        return values.participation.count()

    def get_available_count(seld,values):
        return max(0,values.players_needed-values.current_palyers)


    def validate_players_needed(self,value):
        if value<=0:
            raise serializers.ValidationError("minimum 1 player required")
        
        return value

    def validate_duration(self, value):
        if value <= 0:
            raise serializers.ValidationError("Duration must be greater than 0 minutes.")

        return value

    def validate(self,values):
        sport=values.get('sport')
        custom_sport_name = values.get('custom_sport_name','').strip()

        if sport.name=='other':

            if not custom_sport_name:
                raise serializers.ValidationError({'custom_sport_name':'Please specify the sport name when selecting Other.'})

        values['custom_sport_name'] = custom_sport_name

        return values

